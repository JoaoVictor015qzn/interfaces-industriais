import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Telemetry } from './entities/telemetry.entity';

@Injectable()
export class TelemetryService {
  constructor(
    @InjectRepository(Telemetry)
    private readonly telemetryRepository: Repository<Telemetry>,
  ) {}

  async create(data: {
    deviceId: string;
    temperature?: number | null;
    speed?: number | null;
    pressure?: number | null;
    espStatus?: boolean;
    lockStatus?: boolean;
  }): Promise<Telemetry> {
    const telemetry = this.telemetryRepository.create({
      deviceId: data.deviceId,
      temperature: data.temperature ?? null,
      speed: data.speed ?? null,
      pressure: data.pressure ?? null,
      espStatus: data.espStatus ?? false,
      lockStatus: data.lockStatus ?? true,
    });
    return this.telemetryRepository.save(telemetry);
  }

  async findLatestByDevice(deviceId: string, limit = 20): Promise<Telemetry[]> {
    return this.telemetryRepository.find({
      where: { deviceId },
      order: { recordedAt: 'DESC' },
      take: limit,
    });
  }

  async findLatestOne(deviceId: string): Promise<Telemetry | null> {
    return this.telemetryRepository.findOne({
      where: { deviceId },
      order: { recordedAt: 'DESC' },
    });
  }
}
