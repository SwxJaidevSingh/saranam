/**
 * CallLogs Component
 * Renders a list of communication logs with integrated audio playback
 */
import React, { useEffect, useState, useCallback } from "react";
import { 
  PhoneIncoming, 
  PhoneOutgoing, 
  Clock, 
  Calendar, 
  PlayCircle, 
  RefreshCw,
  Phone,
  AlertCircle
} from "lucide-react";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
// import { Button } from "../ui/button";
import { Alert } from "../ui/alert";
import moment from "moment";
import callLogsApi from "../../api/call-log";

const STATUS_COLORS = {
  completed: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-200",
  busy: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200",
  failed: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200",
  "no-answer": "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-200",
};

export default function CallLogs({ refreshTrigger, start_date, end_date }) {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCalls = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await callLogsApi.getCalls({ start_date, end_date });
      setCalls(data.Calls || []);
    } catch (err) {
      console.error("Error fetching call logs:", err);
      setError("Unable to connect to the call server. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }, [start_date, end_date]);

  // Sync with page-level refresh
  useEffect(() => {
    fetchCalls();
  }, [fetchCalls, refreshTrigger]);

  const getStatusStyles = (status) => {
    return STATUS_COLORS[status?.toLowerCase()] || "bg-secondary text-muted-foreground";
  };

  if (loading && calls.length === 0) {
    return (
      <Card className="p-12">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-muted-foreground font-medium">Loading call history...</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive" className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </Alert>
      )}

      <div className="grid gap-4">
        {calls.length === 0 ? (
          <Card className="p-12 text-center border-dashed">
            <Phone className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground">No call logs found</h3>
            <p className="text-muted-foreground">Processed calls will appear here automatically.</p>
          </Card>
        ) : (
          calls.map((call) => (
            <Card
              key={call.Sid}
              className="p-5 hover:shadow-md transition-all duration-200 border-l-4 border-l-primary/50 hover:border-l-primary"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Caller Information */}
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl ${call.Direction === "inbound" ? "bg-emerald-500/10" : "bg-blue-500/10"}`}>
                    {call.Direction === "inbound" ? (
                      <PhoneIncoming size={20} className="text-emerald-600" />
                    ) : (
                      <PhoneOutgoing size={20} className="text-blue-600" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-foreground tracking-tight">{call.From}</span>
                      <span className="text-muted-foreground/60">→</span>
                      <span className="text-foreground font-semibold">{call.To}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Calendar size={14} className="opacity-70" /> 
                        {moment(call.StartTime).format('MMM D, YYYY')}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock size={14} className="opacity-70" /> 
                        {call.Duration}s
                      </span>
                    </div>
                  </div>
                </div>

                {/* Call Status Badge */}
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className={`px-3 py-1 uppercase text-[10px] font-bold tracking-widest ${getStatusStyles(call.Status)}`}>
                    {call.Status}
                  </Badge>
                </div>
              </div>

              {/* Recording Player */}
              {call.RecordingUrl && (
                <div className="mt-5 pt-4 border-t border-border flex items-center gap-4">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <PlayCircle size={16} className="text-primary" />
                    Recording
                  </div>
                  <audio controls className="h-8 w-full max-w-md opacity-80 hover:opacity-100 transition-opacity">
                    <source src={call.RecordingUrl} type="audio/mpeg" />
                  </audio>
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
