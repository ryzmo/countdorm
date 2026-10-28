"use client";

import { useState, useEffect, useCallback } from "react";

interface LogEntry {
  id: string;
  room: string;
  type: "IN" | "OUT" | "RESET";
  timestamp: string;
  currentCount: number;
}

const ROOMS = [
  { id: "plaza", name: "Plaza" },
  { id: "sergun", name: "Sergun" },
  { id: "kom1", name: "Kom 1" },
  { id: "kom2", name: "Kom 2" },
  { id: "kom3", name: "Kom 3" },
  { id: "kom5", name: "Kom 5" },
  { id: "cws", name: "CWS" },
];

export default function Home() {
  const [selectedRoom, setSelectedRoom] = useState<string>("plaza");
  const [counts, setCounts] = useState<Record<string, number>>({
    plaza: 0,
    sergun: 0,
    kom1: 0,
    kom2: 0,
    kom3: 0,
    kom5: 0,
    cws: 0,
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [processing, setProcessing] = useState<boolean>(false);
  const [dbStatus, setDbStatus] = useState<"connected" | "error" | "loading">("loading");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/crowd");
      const data = await res.json();
      if (data.success) {
        setCounts(data.counts);
        setLogs(data.logs);
        setDbStatus("connected");
      } else {
        setDbStatus("error");
      }
    } catch (e) {
      console.error(e);
      setDbStatus("error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleAction = async (action: "IN" | "OUT") => {
    const current = counts[selectedRoom] || 0;
    if (action === "OUT" && current <= 0) return;

    const optimisticCount = action === "IN" ? current + 1 : current - 1;
    setCounts((prev) => ({ ...prev, [selectedRoom]: optimisticCount }));

    setProcessing(true);
    try {
      const res = await fetch("/api/crowd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: selectedRoom, action }),
      });
      const data = await res.json();
      if (data.success) {
        setCounts((prev) => ({ ...prev, [data.room]: data.nextCount }));
        setLogs((prev) => [data.log, ...prev]);
      } else {
        setCounts((prev) => ({ ...prev, [selectedRoom]: current }));
      }
    } catch (err) {
      console.error(err);
      setCounts((prev) => ({ ...prev, [selectedRoom]: current }));
    } finally {
      setProcessing(false);
    }
  };

  const handleResetRoom = async () => {
    const roomName = ROOMS.find((r) => r.id === selectedRoom)?.name;
    if (!confirm(`Reset counter untuk ${roomName} ke 0 di Neon DB?`)) return;

    try {
      const res = await fetch("/api/crowd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: selectedRoom, action: "RESET" }),
      });
      const data = await res.json();
      if (data.success) {
        setCounts((prev) => ({ ...prev, [data.room]: 0 }));
        setLogs((prev) => [data.log, ...prev]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportCSV = () => {
    if (logs.length === 0) {
      alert("Belum ada data untuk diexport!");
      return;
    }

    const headers = ["ID,Timestamp,Room,Action,OccupancyAfter"];
    const rows = logs.map((log) => {
      const roomName = ROOMS.find((r) => r.id === log.room)?.name || log.room;
      return `"${log.id}","${log.timestamp}","${roomName}","${log.type}","${log.currentCount}"`;
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `dataset_keramaian_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClearLogs = async () => {
    if (!confirm("Hapus seluruh log dataset di Neon DB?")) return;
    try {
      const res = await fetch("/api/crowd", { method: "DELETE" });
      const data = await res.json();
      if (data.success) setLogs([]);
    } catch (e) {
      console.error(e);
    }
  };

  const activeRoomObj = ROOMS.find((r) => r.id === selectedRoom);

  return (
    <main
      className="min-h-screen p-4 md:p-8 flex flex-col items-center justify-start transition-colors"
      style={{ backgroundColor: "#F1FAFB", color: "#1D2A44" }}
    >
      <div className="w-full max-w-xl flex flex-col gap-5">
        
        {/* Header Bar */}
        <header
          className="p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 border"
          style={{ backgroundColor: "#ffffff", borderColor: "#A0E4F1" }}
        >
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight" style={{ color: "#1D2A44" }}>
                Dataset Keramaian
              </h1>
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider"
                style={{
                  backgroundColor: dbStatus === "connected" ? "#7ae5cf33" : "#f4d06f44",
                  color: dbStatus === "connected" ? "#1D2A44" : "#C59560",
                  border: `1px solid ${dbStatus === "connected" ? "#7ae5cf" : "#f4d06f"}`,
                }}
              >
                {dbStatus === "connected" ? "Neon DB Connected" : dbStatus === "loading" ? "Connecting..." : "Offline"}
              </span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: "#9AA6B2" }}>
              Counter pencatatan masuk/keluar orang
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white shadow-xs transition active:scale-95"
              style={{ backgroundColor: "#4A4DE7" }}
            >
              Export CSV
            </button>
            <button
              onClick={handleClearLogs}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold transition active:scale-95 border"
              style={{ backgroundColor: "#F1FAFB", color: "#9AA6B2", borderColor: "#A0E4F1" }}
            >
              Clear
            </button>
          </div>
        </header>

        {/* Room Selector */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#9AA6B2" }}>
              Pilih Ruangan
            </label>
            <span className="text-[11px] font-medium" style={{ color: "#7EA6F4" }}>
              {activeRoomObj?.name} Terpilih
            </span>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
            {ROOMS.map((room) => {
              const isSelected = selectedRoom === room.id;
              const count = counts[room.id] || 0;
              return (
                <button
                  key={room.id}
                  onClick={() => setSelectedRoom(room.id)}
                  className="flex flex-col items-center justify-center py-2.5 px-1 rounded-xl border text-center transition-all active:scale-95 shadow-xs"
                  style={{
                    backgroundColor: isSelected ? "#7EA6F4" : "#ffffff",
                    borderColor: isSelected ? "#4A4DE7" : "#A0E4F1",
                    color: isSelected ? "#ffffff" : "#1D2A44",
                  }}
                >
                  <span className="text-xs font-bold truncate max-w-full">{room.name}</span>
                  <span
                    className="text-[10px] mt-1 px-1.5 py-0.2 rounded-full font-mono font-medium"
                    style={{
                      backgroundColor: isSelected ? "#ffffff" : "#F1FAFB",
                      color: isSelected ? "#4A4DE7" : "#1D2A44",
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Counter Card */}
        <section
          className="rounded-3xl p-6 flex flex-col items-center gap-5 shadow-sm border relative overflow-hidden"
          style={{ backgroundColor: "#ffffff", borderColor: "#A0E4F1" }}
        >
          {loading && (
            <div
              className="absolute inset-0 flex items-center justify-center z-10 text-xs font-medium"
              style={{ backgroundColor: "rgba(241, 250, 251, 0.8)", color: "#1D2A44" }}
            >
              Sinkronisasi data Neon DB...
            </div>
          )}

          <div className="text-center">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#9AA6B2" }}>
              Total Orang di {activeRoomObj?.name}
            </span>
            <div
              className="text-7xl font-black mt-1 font-mono tracking-tight"
              style={{ color: "#1D2A44" }}
            >
              {counts[selectedRoom] || 0}
            </div>
          </div>

          {/* Action Buttons: Hijau Masuk & Merah Keluar */}
          <div className="grid grid-cols-2 gap-3.5 w-full">
            {/* Hijau (#7ae5cf) Masuk */}
            <button
              onClick={() => handleAction("IN")}
              disabled={processing}
              className="flex flex-col items-center justify-center py-7 rounded-2xl font-bold transition shadow-md active:scale-98 select-none"
              style={{
                backgroundColor: "#7ae5cf",
                color: "#1D2A44",
              }}
            >
              <span className="text-4xl leading-none font-black mb-1">+</span>
              <span className="text-base tracking-wider uppercase">Masuk</span>
            </button>

            {/* Merah (#d9534f) Keluar */}
            <button
              onClick={() => handleAction("OUT")}
              disabled={processing || (counts[selectedRoom] || 0) <= 0}
              className="flex flex-col items-center justify-center py-7 rounded-2xl font-bold transition shadow-md active:scale-98 select-none disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                backgroundColor: "#d9534f",
                color: "#ffffff",
              }}
            >
              <span className="text-4xl leading-none font-black mb-1">-</span>
              <span className="text-base tracking-wider uppercase">Keluar</span>
            </button>
          </div>

          {/* Reset Room Button */}
          <button
            onClick={handleResetRoom}
            className="text-xs font-medium hover:underline transition"
            style={{ color: "#C59560" }}
          >
            Reset counter {activeRoomObj?.name} ke 0
          </button>
        </section>

        {/* Log Activity */}
        <section
          className="rounded-2xl p-4 shadow-sm border"
          style={{ backgroundColor: "#ffffff", borderColor: "#A0E4F1" }}
        >
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: "#1D2A44" }}>
              Riwayat Aktivitas ({logs.length})
            </h2>
            <span className="text-[11px]" style={{ color: "#9AA6B2" }}>
              Tersimpan di Neon DB
            </span>
          </div>

          {logs.length === 0 ? (
            <p className="text-xs text-center py-6" style={{ color: "#9AA6B2" }}>
              Belum ada data counter yang dicatat.
            </p>
          ) : (
            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
              {logs.slice(0, 50).map((log) => {
                const roomName = ROOMS.find((r) => r.id === log.room)?.name || log.room;
                const isEntry = log.type === "IN";
                const isReset = log.type === "RESET";
                const dateObj = new Date(log.timestamp);
                const timeStr = dateObj.toLocaleTimeString("id-ID", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                });

                return (
                  <div
                    key={log.id}
                    className="flex items-center justify-between p-2 rounded-xl text-xs border"
                    style={{
                      backgroundColor: "#F1FAFB",
                      borderColor: "#A0E4F1",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="px-2 py-0.5 rounded-md font-bold uppercase tracking-wider text-[10px]"
                        style={{
                          backgroundColor: isEntry ? "#7ae5cf" : isReset ? "#f4d06f" : "#d9534f",
                          color: isEntry || isReset ? "#1D2A44" : "#ffffff",
                        }}
                      >
                        {isEntry ? "Masuk" : isReset ? "Reset" : "Keluar"}
                      </span>
                      <span className="font-semibold" style={{ color: "#1D2A44" }}>
                        {roomName}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 font-mono">
                      <span style={{ color: "#4A4DE7" }}>
                        Total: <strong>{log.currentCount}</strong>
                      </span>
                      <span className="text-[11px]" style={{ color: "#9AA6B2" }}>
                        {timeStr}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
