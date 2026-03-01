import React, { useEffect, useState } from 'react';
import { getFullUrl } from '../../apiConfig';

interface ExternalDataCardProps {
  title: string;
  artist: string;
}

const ExternalDataCard: React.FC<ExternalDataCardProps> = ({ title, artist }) => {
  const [lastfmData, setLastfmData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const lastfmRes = await fetch(getFullUrl(`/proxy/lastfm/track?artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(title)}`));
        if (lastfmRes.ok) {
          const data = await lastfmRes.json();
          setLastfmData(data);
        }
      } catch (err) {
        console.error('Error fetching external data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [title, artist]);

  if (loading) return <div className="p-4 border rounded-lg">Loading...</div>;

  return (
    <div className="p-4 border rounded-lg bg-white dark:bg-slate-900">
      <h3 className="font-bold mb-4">Linked Data</h3>

      {lastfmData && (
        <div className="mb-4">
          <h4 className="font-semibold">Last.fm</h4>
          <p>Listeners: {lastfmData.listeners ?? 'N/A'}</p>
          <p>Playcount: {lastfmData.playcount ?? 'N/A'}</p>
        </div>
      )}

    </div>
  );
};

export default ExternalDataCard;
