'use client';
import { useEffect, useState } from 'react';
import { db } from '@/app/lib/firebase-client';
import { ref, onValue, query, orderByChild, equalTo, update, set } from 'firebase/database';
import { UserGroupIcon, DocumentTextIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import dynamic from 'next/dynamic'; // Dynamically import the chart to avoid hydration errors

// Dynamically import the chart (client-side only)
const BarChart = dynamic(() => import('recharts/es6/chart/BarChart'), { ssr: false });
const Bar = dynamic(() => import('recharts/es6/cartesian/Bar'), { ssr: false });
const XAxis = dynamic(() => import('recharts/es6/cartesian/XAxis'), { ssr: false });
const YAxis = dynamic(() => import('recharts/es6/cartesian/YAxis'), { ssr: false });
const Tooltip = dynamic(() => import('recharts/es6/component/Tooltip'), { ssr: false });
const Legend = dynamic(() => import('recharts/es6/component/Legend'), { ssr: false });

interface Report {
  id: string;
  createdAt: number;
  description: string;
  email: string;
  matterType: string;
  name: string;
  phone: string;
  resolvedAt?: number;
  response?: string;
  status: string;
  userId: string;
}

interface Stats {
  totalUsers: number;
  totalReports: number;
  resolvedReports: number;
}

export default function AdminDashboard() {
  const [reports, setReports] = useState<Report[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalReports: 0,
    resolvedReports: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [responseText, setResponseText] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const reportsRef = ref(db, 'reports');
        const usersRef = ref(db, 'users');

        // Fetch reports
        onValue(reportsRef, (snapshot) => {
          const reportsData: Report[] = [];
          snapshot.forEach((childSnapshot) => {
            const report = {
              id: childSnapshot.key as string,
              ...childSnapshot.val()
            };
            reportsData.push(report);
          });
          setReports(reportsData);
          setStats(prev => ({ ...prev, totalReports: reportsData.length }));
        }, (error) => {
          console.error("Error fetching reports:", error);
          setError("Unable to fetch reports. Please check your permissions.");
        });

        // Fetch users
        onValue(usersRef, (snapshot) => {
          setStats(prev => ({ ...prev, totalUsers: snapshot.size }));
        }, (error) => {
          console.error("Error fetching users:", error);
        });

        // Fetch resolved reports
        const resolvedQuery = query(reportsRef, orderByChild('status'), equalTo('resolved'));
        onValue(resolvedQuery, (snapshot) => {
          setStats(prev => ({ ...prev, resolvedReports: snapshot.size }));
        }, (error) => {
          console.error("Error fetching resolved reports:", error);
        });

        setLoading(false);

      } catch (err) {
        console.error("Error setting up listeners:", err);
        setError("Unable to connect to the database. Please try again later.");
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const toggleResolveStatus = async (reportId: string, currentStatus: string, response?: string): Promise<void> => {
    try {
      const reportRef = ref(db, `reports/${reportId}`);
      await update(reportRef, {
        status: currentStatus === 'resolved' ? 'pending' : 'resolved',
        response: response || '',
        resolvedAt: Date.now()
      });
    } catch (err) {
      console.error("Error updating report status:", err);
      setError("Unable to update report status. Please check your permissions.");
    }
  };

  const sendNotificationToUser = async (userId: string, reportId: string, response: string) => {
    try {
      const notificationRef = ref(db, `users/${userId}/notifications/${reportId}`);
      await set(notificationRef, {
        type: 'report_response',
        message: `Your report (ID: ${reportId}) has been responded to.`,
        response: response, // Include the admin's response
        createdAt: Date.now(),
        read: false
      });
    } catch (error) {
      console.error('Error sending notification:', error);
      throw new Error('Failed to send notification.');
    }
  };

  const handleReportClick = (report: Report) => {
    setSelectedReport(report);
    setResponseText(report.response || '');
  };

  const handleResponseSubmit = async () => {
    if (selectedReport) {
      try {
        // Update the report with the admin's response
        await toggleResolveStatus(selectedReport.id, selectedReport.status, responseText);

        // Send a notification to the user
        await sendNotificationToUser(selectedReport.userId, selectedReport.id, responseText);

        // Reset the modal
        setSelectedReport(null);
        setResponseText('');
      } catch (error) {
        console.error('Error submitting response:', error);
        setError('Failed to submit response. Please try again.');
      }
    }
  };

  const handleBlockUser = async (userId: string) => {
    try {
      const userRef = ref(db, `users/${userId}`);
      await update(userRef, { blocked: true });
      alert('User blocked successfully');
    } catch (err) {
      console.error("Error blocking user:", err);
      setError("Unable to block user. Please check your permissions.");
    }
  };

  const StatsCard = ({ title, value, icon: Icon, color, onClick }: { 
    title: string; 
    value: number; 
    icon: React.ElementType;
    color: string;
    onClick?: () => void;
  }) => (
    <div className={`p-6 rounded-lg shadow-sm ${color} text-white cursor-pointer`} onClick={onClick}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-3xl font-bold mt-2">{value}</p>
        </div>
        <Icon className="w-12 h-12 opacity-75" />
      </div>
    </div>
  );

  // Community Chart Data
  const communityChartData = reports
    .filter(report => report.matterType === 'Community')
    .map(report => ({
      name: report.name,
      reports: 1
    }));

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Admin Dashboard</h1>
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-700">
            <h2 className="text-lg font-semibold mb-2">Error</h2>
            <p>{error}</p>
            <div className="mt-4">
              <p className="text-sm">Make sure you:</p>
              <ul className="list-disc ml-5 mt-2 text-sm">
                <li>Are logged in with an admin account</li>
                <li>Have the correct permissions in Firebase</li>
                <li>Have properly configured Firebase security rules</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Admin Dashboard</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <StatsCard 
            title="Total Users" 
            value={stats.totalUsers} 
            icon={UserGroupIcon} 
            color="bg-indigo-600" 
          />
          <StatsCard 
            title="Total Reports" 
            value={stats.totalReports} 
            icon={DocumentTextIcon}
            color="bg-red-600" 
          />
          <StatsCard 
            title="Resolved Cases" 
            value={stats.resolvedReports} 
            icon={ShieldCheckIcon}
            color="bg-purple-600" 
          />
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Recent Reports</h2>
            <p className="text-gray-600 mt-1">Manage and respond to user submissions</p>
          </div>
          
          <div className="divide-y divide-gray-200">
            {loading ? (
              <div className="p-6 text-center text-gray-500">Loading reports...</div>
            ) : reports.length === 0 ? (
              <div className="p-6 text-center text-gray-500">No reports found</div>
            ) : (
              reports.map(report => (
                <div key={report.id} className="p-6 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => handleReportClick(report)}>
                  <div className="flex justify-between items-start">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-medium text-gray-900">{report.name}</h3>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          report.status === 'resolved' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {report.status?.toUpperCase() || 'PENDING'}
                        </span>
                      </div>
                      <p className="text-gray-600">{report.description}</p>
                      <div className="text-sm text-gray-500">
                        <p>Email: {report.email}</p>
                        <p>Phone: {report.phone}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Community Chart */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Community Reports</h2>
          {communityChartData.length > 0 ? (
            <BarChart width={600} height={300} data={communityChartData}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="reports" fill="#4F46E5" />
            </BarChart>
          ) : (
            <p className="text-gray-500">No community reports found.</p>
          )}
        </div>

        {/* Report Details Modal */}
        {selectedReport && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Report Details</h2>
              <p className="text-gray-600">{selectedReport.description}</p>
              <div className="text-sm text-gray-500 mt-4">
                <p>Email: {selectedReport.email}</p>
                <p>Phone: {selectedReport.phone}</p>
              </div>
              <textarea
                className="w-full p-2 mt-4 border rounded-md"
                placeholder="Enter your response..."
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
              />
              <div className="mt-4 flex gap-2">
                <button 
                  onClick={handleResponseSubmit}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md"
                >
                  Submit Response
                </button>
                <button 
                  onClick={() => handleBlockUser(selectedReport.userId)}
                  className="px-4 py-2 bg-red-600 text-white rounded-md"
                >
                  Block User
                </button>
                <button 
                  onClick={() => setSelectedReport(null)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}