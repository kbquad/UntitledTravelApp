import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { formatDistance, formatDuration } from '../utils/geo';
import { PrimaryButton, SecondaryButton } from '../components/ui';

export default function TripHistoryScreen({ t }) {
  const navigate = useNavigate();
  const units = useStore((s) => s.units);
  const trips = useStore((s) => s.trips);
  const setTripFrom = useStore((s) => s.setTripFrom);
  const setTripTo = useStore((s) => s.setTripTo);
  const clearTripVia = useStore((s) => s.clearTripVia);
  const addTripVia = useStore((s) => s.addTripVia);

  const driveAgain = (trip) => {
    setTripFrom({ label: trip.fromLabel, lat: trip.from.lat, lng: trip.from.lng });
    setTripTo({ label: trip.toLabel, lat: trip.to.lat, lng: trip.to.lng });
    clearTripVia();
    (trip.via ?? []).forEach((v) => addTripVia(v));
    navigate('/plan');
  };

  return (
    <div className="screen" style={{ background: t.bg }}>
      <div
        className="scroll enter"
        style={{
          padding: '8px 20px 0', paddingTop: 'calc(8px + var(--safe-t))',
          paddingBottom: 'var(--scroll-pad-b)', display: 'flex', flexDirection: 'column', gap: 16,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-.02em', color: t.text }}>
          Trip history
        </h2>

        {trips.length === 0 && (
          <div style={{
            marginTop: 40, display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 12, textAlign: 'center', padding: '0 20px',
          }}
          >
            <div style={{ fontSize: 16, fontWeight: 800, color: t.text }}>No trips yet</div>
            <div style={{ fontSize: 13.5, lineHeight: 1.55, color: t.body }}>
              Plan a route and it lands here once you preview the drive.
            </div>
            <PrimaryButton t={t} onClick={() => navigate('/plan')} style={{ maxWidth: 220, marginTop: 4 }}>
              Plan a route
            </PrimaryButton>
          </div>
        )}

        {trips.map((trip) => (
          <div
            key={trip.id}
            style={{
              borderRadius: 20, background: t.card, border: `1px solid ${t.line}`,
              padding: 17, display: 'flex', flexDirection: 'column', gap: 12,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-.01em', color: t.text }}>
                {trip.fromLabel?.split(',')[0]} → {trip.toLabel?.split(',')[0]}
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: t.sub, whiteSpace: 'nowrap' }}>
                {new Date(trip.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 20 }}>
              {[
                [formatDistance(trip.distanceM, units), 'distance'],
                [formatDuration(trip.durationS), 'driving'],
                [String(trip.via?.length ?? 0), 'via stops'],
              ].map(([value, label]) => (
                <span key={label} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: t.text }}>{value}</span>
                  <span style={{ fontSize: 12, color: t.sub }}>{label}</span>
                </span>
              ))}
            </div>

            <SecondaryButton t={t} onClick={() => driveAgain(trip)} style={{ alignSelf: 'flex-start' }}>
              Drive it again
            </SecondaryButton>
          </div>
        ))}
      </div>
    </div>
  );
}
