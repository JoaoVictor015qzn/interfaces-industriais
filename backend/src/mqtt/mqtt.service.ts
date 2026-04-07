import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mqtt from 'mqtt';
import { TelemetryService } from '../telemetry/telemetry.service';
import { TelemetryGateway } from '../telemetry/telemetry.gateway';
import { DevicesService } from '../devices/devices.service';

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private client!: mqtt.MqttClient;
  private readonly logger = new Logger(MqttService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly telemetryService: TelemetryService,
    private readonly telemetryGateway: TelemetryGateway,
    private readonly devicesService: DevicesService,
  ) {}

  onModuleInit() {
    const url = this.configService.get<string>('MQTT_URL', 'mqtt://localhost:1883');
    this.client = mqtt.connect(url);

    this.client.on('connect', () => {
      this.logger.log('Connected to MQTT broker');
      // Subscribe to telemetry from all devices
      this.client.subscribe('devices/+/telemetry', (err) => {
        if (err) this.logger.error('Failed to subscribe to telemetry', err);
      });
      // Subscribe to command acknowledgements
      this.client.subscribe('devices/+/command/ack', (err) => {
        if (err) this.logger.error('Failed to subscribe to command acks', err);
      });
    });

    this.client.on('message', (topic: string, message: Buffer) => {
      this.handleMessage(topic, message).catch((err) =>
        this.logger.error(`Error handling MQTT message: ${err.message}`, err.stack),
      );
    });

    this.client.on('error', (err) => {
      this.logger.error('MQTT connection error', err);
    });
  }

  onModuleDestroy() {
    if (this.client) {
      this.client.end();
    }
  }

  /**
   * Handle incoming MQTT messages from ESP devices
   */
  private async handleMessage(topic: string, message: Buffer) {
    const parts = topic.split('/');
    // Topic format: devices/<deviceKey>/telemetry
    // Topic format: devices/<deviceKey>/command/ack

    if (parts.length >= 3 && parts[0] === 'devices') {
      const deviceKey = parts[1];
      const device = await this.devicesService.findByDeviceKey(deviceKey);

      if (!device) {
        this.logger.warn(`Unknown device key: ${deviceKey}`);
        return;
      }

      if (parts[2] === 'telemetry') {
        const data = JSON.parse(message.toString()) as {
          temperature?: number;
          speed?: number;
          pressure?: number;
          espStatus?: boolean;
          lockStatus?: boolean;
        };

        // Save telemetry
        const telemetry = await this.telemetryService.create({
          deviceId: device.id,
          ...data,
        });

        // Update device status to online
        await this.devicesService.updateStatus(device.id, 'online');

        // Update device state
        if (data.lockStatus !== undefined || data.speed !== undefined) {
          await this.devicesService.updateDeviceState(device.id, {
            lockStatus: data.lockStatus,
            speedValue: data.speed,
          });
        }

        // Broadcast to frontend via WebSocket
        this.telemetryGateway.broadcastTelemetry(device.id, {
          temperature: telemetry.temperature,
          speed: telemetry.speed,
          pressure: telemetry.pressure,
          espStatus: telemetry.espStatus,
          lockStatus: telemetry.lockStatus,
          recordedAt: telemetry.recordedAt,
          deviceName: device.name,
        });

        this.telemetryGateway.broadcastDeviceStatus(device.id, 'online');
      }
    }
  }

  /**
   * Publish a command to a device via MQTT
   */
  publishCommand(deviceId: string, command: Record<string, unknown>) {
    // We use deviceId in the topic; the ESP subscribes to its own topic
    const topic = `devices/${deviceId}/command`;
    this.client.publish(topic, JSON.stringify(command), { qos: 1 });
    this.logger.log(`Command published to ${topic}: ${JSON.stringify(command)}`);
  }
}
