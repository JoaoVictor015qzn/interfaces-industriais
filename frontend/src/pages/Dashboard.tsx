import { useEffect, useState } from 'react';
import { useSocket } from '../hooks/useSocket';
import { deviceService, type Device } from '../services/deviceService';

export default function Dashboard() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const { lastTelemetry, lastStatus, connected } = useSocket();

  // Telemetry state per device
  const [telemetryMap, setTelemetryMap] = useState<
    Record<string, { temperature?: number; speed?: number; pressure?: number; espStatus?: boolean; lockStatus?: boolean }>
  >({});

  useEffect(() => {
    deviceService.findAll().then((data) => {
      setDevices(data);
      setLoading(false);
    });
  }, []);

  // Update telemetry from WebSocket
  useEffect(() => {
    if (lastTelemetry) {
      setTelemetryMap((prev) => ({
        ...prev,
        [lastTelemetry.deviceId]: {
          temperature: lastTelemetry.temperature,
          speed: lastTelemetry.speed,
          pressure: lastTelemetry.pressure,
          espStatus: lastTelemetry.espStatus,
          lockStatus: lastTelemetry.lockStatus,
        },
      }));
    }
  }, [lastTelemetry]);

  // Update device status from WebSocket
  useEffect(() => {
    if (lastStatus) {
      setDevices((prev) =>
        prev.map((d) =>
          d.id === lastStatus.deviceId
            ? { ...d, status: lastStatus.status as Device['status'] }
            : d,
        ),
      );
    }
  }, [lastStatus]);

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
      </div>
    );
  }

  // Aggregate stats
  const totalDevices = devices.length;
  const onlineDevices = devices.filter((d) => d.status === 'online').length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="page-header-sub">
            Monitoramento em tempo real dos dispositivos IoT
          </p>
        </div>
        <div>
          <span
            className={`badge ${connected ? 'badge-online' : 'badge-offline'}`}
          >
            <span className="badge-dot" />
            {connected ? 'WebSocket Conectado' : 'Desconectado'}
          </span>
        </div>
      </div>

      {/* Overview cards */}
      <div className="grid-dashboard">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Total Dispositivos</span>
            <div className="card-icon status">📡</div>
          </div>
          <div className="card-value">{totalDevices}</div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Online</span>
            <div className="card-icon status">🟢</div>
          </div>
          <div className="card-value" style={{ color: 'var(--status-online)' }}>
            {onlineDevices}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Offline</span>
            <div className="card-icon temp">🔴</div>
          </div>
          <div className="card-value" style={{ color: 'var(--status-offline)' }}>
            {totalDevices - onlineDevices}
          </div>
        </div>
      </div>

      {/* Per-device sensor readings */}
      {devices.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📡</div>
          <div className="empty-state-text">Nenhum dispositivo cadastrado ainda</div>
        </div>
      ) : (
        devices.map((device) => {
          const t = telemetryMap[device.id];
          return (
            <div key={device.id} style={{ marginBottom: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{device.name}</h2>
                <span className={`badge ${device.status === 'online' ? 'badge-online' : 'badge-offline'}`}>
                  <span className="badge-dot" />
                  {device.status}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {device.type}
                </span>
              </div>

              <div className="grid-dashboard">
                <div className="card">
                  <div className="card-header">
                    <span className="card-title">Temperatura</span>
                    <div className="card-icon temp">🌡️</div>
                  </div>
                  <div className="card-value">
                    {t?.temperature?.toFixed(1) ?? '--'}
                    <span className="card-unit">°C</span>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header">
                    <span className="card-title">Velocidade</span>
                    <div className="card-icon speed">⚡</div>
                  </div>
                  <div className="card-value">
                    {t?.speed?.toFixed(0) ?? '--'}
                    <span className="card-unit">%</span>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header">
                    <span className="card-title">Pressão</span>
                    <div className="card-icon pressure">🔧</div>
                  </div>
                  <div className="card-value">
                    {t?.pressure?.toFixed(1) ?? '--'}
                    <span className="card-unit">bar</span>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header">
                    <span className="card-title">Status ESP</span>
                    <div className="card-icon status">📟</div>
                  </div>
                  <div className="card-value" style={{ fontSize: '1.3rem' }}>
                    <span className={`badge ${t?.espStatus ? 'badge-online' : 'badge-offline'}`}>
                      <span className="badge-dot" />
                      {t?.espStatus ? 'ON' : 'OFF'}
                    </span>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header">
                    <span className="card-title">Trava</span>
                    <div className="card-icon lock">🔒</div>
                  </div>
                  <div className="card-value" style={{ fontSize: '1.3rem' }}>
                    <span className={`badge ${t?.lockStatus ? 'badge-locked' : 'badge-unlocked'}`}>
                      {t?.lockStatus ? '🔒 Travado' : '🔓 Destravado'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })
      )}
    </>
  );
}
