import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Download, 
  Trash2, 
  Search, 
  RefreshCw, 
  Calendar,
  Clock,
  User
} from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '@/utils/adminApi';

const SessionManagement = ({ onStatsUpdate }) => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getSessions();
      if (data.success === true || data.sessions) {
        setSessions(data.sessions || []);
      } else {
        toast.error(data.error || 'Failed to fetch sessions');
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
      toast.error('Error fetching sessions. Please check your admin permissions.');
    } finally {
      setLoading(false);
    }
  };

  const deleteSession = async (sessionId) => {
    if (!confirm('Are you sure you want to delete this session?')) return;

    try {
      const data = await adminApi.deleteSession(sessionId);
      if (data.success === true || data.message === 'Session deleted successfully') {
        toast.success('Session deleted successfully');
        fetchSessions();
        onStatsUpdate?.();
      } else {
        toast.error(data.error || 'Failed to delete session');
      }
    } catch (error) {
      console.error('Error deleting session:', error);
      toast.error('Error deleting session. Please check your admin permissions.');
    }
  };

  const downloadSessionData = async () => {
    try {
      const response = await adminApi.downloadSessions();
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sessions-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('Session data downloaded');
      } else {
        toast.error('Failed to download session data');
      }
    } catch (error) {
      console.error('Error downloading session data:', error);
      toast.error('Error downloading session data. Please check your admin permissions.');
    }
  };

  const downloadSessionCreds = async (sessionId) => {
    try {
      const response = await adminApi.downloadSessionCreds(sessionId);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${sessionId}-creds.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success(`Session ${sessionId} credentials downloaded`);
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to download session credentials');
      }
    } catch (error) {
      console.error('Error downloading session credentials:', error);
      toast.error('Error downloading session credentials. Please check your admin permissions.');
    }
  };

  const filteredSessions = sessions.filter(session =>
    session.sessionId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getTimeRemaining = (expiresAt) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry - now;
    
    if (diff <= 0) return 'Expired';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex gap-2">
          <Button onClick={fetchSessions} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={downloadSessionData}>
            <Download className="w-4 h-4 mr-2" />
            Download All
          </Button>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search sessions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 w-full sm:w-64"
          />
        </div>
      </div>

      {/* Sessions List */}
      <div className="grid gap-4">
        {loading ? (
          <Card>
            <CardContent className="p-6 text-center">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Loading sessions...</p>
            </CardContent>
          </Card>
        ) : filteredSessions.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <User className="w-8 h-8 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                {searchQuery ? 'No sessions found matching your search' : 'No sessions found'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredSessions.map((session) => (
            <Card key={session.sessionId} className="border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-mono">
                    {session.sessionId}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadSessionCreds(session.sessionId)}
                      className="text-blue-600 hover:text-blue-700"
                      title="Download session credentials"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteSession(session.sessionId)}
                      className="text-red-600 hover:text-red-700"
                      title="Delete session"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Created</p>
                      <p className="text-muted-foreground">{formatDate(session.createdAt)}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Expires</p>
                      <p className="text-muted-foreground">{formatDate(session.expiresAt)}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Time Remaining</p>
                      <p className={`font-medium ${
                        getTimeRemaining(session.expiresAt) === 'Expired' 
                          ? 'text-red-500' 
                          : 'text-green-500'
                      }`}>
                        {getTimeRemaining(session.expiresAt)}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Summary */}
      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Total Sessions: {filteredSessions.length}
            </span>
            <span className="text-muted-foreground">
              Expired: {filteredSessions.filter(s => new Date(s.expiresAt) <= new Date()).length}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SessionManagement;