'use client';
import { useEffect, useState } from 'react';
import { db } from '@/app/lib/firebase-client';
import { ref, onValue, query, orderByChild, equalTo, update, set } from 'firebase/database';
import { UserGroupIcon, DocumentTextIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';

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
  communityMessage?: string;
}

interface Stats {
  totalUsers: number;
  totalReports: number;
  resolvedReports: number;
}

interface CommunityData {
  name: string;
  reports: number;
  messages: string[];
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
  const [communityData, setCommunityData] = useState<CommunityData[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [userMessages, setUserMessages] = useState<string[]>([]);

  // Define theme colors
  const themeColors = {
    primary: 'bg-pink-600', // Pink primary color
    secondary: 'bg-purple-600', // Purple secondary color
    tertiary: 'bg-fuchsia-500', // Fuchsia tertiary color
    accent: '#d946ef', // Hex color for charts
    lightBg: 'bg-pink-50', // Light pink background
    border: 'border-pink-200', // Pink border
    text: 'text-purple-900', // Purple text
    textSecondary: 'text-pink-700', // Pink text
    hoverBg: 'hover:bg-pink-50', // Hover background color
  };

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
          
          // Process community data
          const communityReports = reportsData.filter(report => report.matterType === 'Community');
          const communityDataMap = new Map<string, CommunityData>();
          
          communityReports.forEach(report => {
            if (!communityDataMap.has(report.name)) {
              communityDataMap.set(report.name, {
                name: report.name,
                reports: 1,
                messages: [report.description]
              });
            } else {
              const userData = communityDataMap.get(report.name)!;
              userData.reports += 1;
              userData.messages.push(report.description);
              communityDataMap.set(report.name, userData);
            }
          });
          
          setCommunityData(Array.from(communityDataMap.values()));
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
        response: response,
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

  const handleCommunityUserClick = (name: string) => {
    setSelectedUser(name);
    const userData = communityData.find(data => data.name === name);
    if (userData) {
      setUserMessages(userData.messages);
    } else {
      setUserMessages([]);
    }
  };

  const StatsCard = ({ title, value, icon: Icon, color, onClick }: { 
    title: string; 
    value: number; 
    icon: React.ElementType;
    color: string;
    onClick?: () => void;
  }) => (
    <div className={`p-6 rounded-lg shadow-md ${color} text-white cursor-pointer transition-transform duration-300 transform hover:scale-105`} onClick={onClick}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-3xl font-bold mt-2">{value}</p>
        </div>
        <Icon className="w-12 h-12 opacity-75" />
      </div>
    </div>
  );

  // Chart with proper typing
  const renderCommunityChart = () => {
    if (!communityData.length) return <p className="text-gray-500">No community reports found.</p>;

    return (
      <div className="overflow-x-auto">
        <BarChart 
          width={600} 
          height={300} 
          data={communityData}
        >
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="reports" fill={themeColors.accent} />
        </BarChart>
      </div>
    );
  };

  if (error) {
    return (
      <div className={`min-h-screen ${themeColors.lightBg} p-8`}>
        <div className="max-w-7xl mx-auto">
          <h1 className={`text-3xl font-bold ${themeColors.text} mb-8`}>Admin Dashboard</h1>
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
    <div className={`min-h-screen ${themeColors.lightBg} p-8`}>
      <div className="max-w-7xl mx-auto">
        <h1 className={`text-3xl font-bold ${themeColors.text} mb-8`}>Admin Dashboard</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <StatsCard 
            title="Total Users" 
            value={stats.totalUsers} 
            icon={UserGroupIcon} 
            color={themeColors.primary}
          />
          <StatsCard 
            title="Total Reports" 
            value={stats.totalReports} 
            icon={DocumentTextIcon}
            color={themeColors.secondary}
          />
          <StatsCard 
            title="Resolved Cases" 
            value={stats.resolvedReports} 
            icon={ShieldCheckIcon}
            color={themeColors.tertiary}
          />
        </div>

        <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-pink-100">
          <div className={`p-6 border-b ${themeColors.border}`}>
            <h2 className={`text-xl font-semibold ${themeColors.text}`}>Recent Reports</h2>
            <p className={`${themeColors.textSecondary} mt-1`}>Manage and respond to user submissions</p>
          </div>
          
          <div className="divide-y divide-pink-100">
            {loading ? (
              <div className="p-6 text-center text-gray-500">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-500 mx-auto mb-4"></div>
                <p>Loading reports...</p>
              </div>
            ) : reports.length === 0 ? (
              <div className="p-6 text-center text-gray-500">No reports found</div>
            ) : (
              reports.map(report => (
                <div key={report.id} className={`p-6 ${themeColors.hoverBg} transition-colors cursor-pointer`} onClick={() => handleReportClick(report)}>
                  <div className="flex justify-between items-start">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className={`text-lg font-medium ${themeColors.text}`}>{report.name}</h3>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          report.status === 'resolved' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-pink-100 text-pink-800'
                        }`}>
                          {report.status?.toUpperCase() || 'PENDING'}
                        </span>
                      </div>
                      <p className="text-gray-600">{report.description}</p>
                      <div className="text-sm text-gray-500">
                        <p>Email: {report.email}</p>
                        <p>Phone: {report.phone}</p>
                        <p>Type: {report.matterType}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Community Reports Section */}
        <div className="mt-8 bg-white rounded-lg shadow-lg border border-pink-100">
          <div className={`p-6 border-b ${themeColors.border}`}>
            <h2 className={`text-xl font-semibold ${themeColors.text}`}>Community Reports</h2>
            <p className={`${themeColors.textSecondary} mt-1`}>View and manage community submissions</p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
            {/* Chart Panel */}
            <div className="overflow-x-auto">
              {renderCommunityChart()}
              <div className="mt-4 text-sm text-gray-500">
                <p>Click on a user in the chart to view their messages</p>
              </div>
            </div>
            
            {/* User Messages Panel */}
            <div className="border border-pink-100 rounded-lg p-4">
              <h3 className={`text-lg font-medium ${themeColors.text} mb-4`}>
                {selectedUser ? `${selectedUser}'s Messages` : 'Select a user to view messages'}
              </h3>
              
              {selectedUser ? (
                userMessages.length > 0 ? (
                  <div className="space-y-3 text-gray-600 max-h-96 overflow-y-auto">
                    {userMessages.map((message, index) => (
                      <div key={index} className="p-3 bg-pink-50 rounded-lg">
                        <p>{message}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No messages found for this user.</p>
                )
              ) : (
                <div className="flex flex-col gap-4">
                  {communityData.map((userData) => (
                    <div 
                      key={userData.name}
                      className={`p-3 border border-pink-100 rounded-lg cursor-pointer hover:bg-pink-50 transition-colors`}
                      onClick={() => handleCommunityUserClick(userData.name)}
                    >
                      <div className="flex justify-between">
                        <span className="font-medium">{userData.name}</span>
                        <span className="text-sm text-pink-700">{userData.reports} message(s)</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {selectedUser && (
                <button 
                  onClick={() => setSelectedUser(null)}
                  className="mt-4 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                >
                  Back to User List
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Report Details Modal */}
        {selectedReport && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl shadow-xl border-2 border-pink-200">
              <h2 className={`text-xl font-semibold ${themeColors.text} mb-4`}>Report Details</h2>
              <div className="mb-4">
                <p className="font-medium text-gray-600">From: {selectedReport.name}</p>
                <p className="text-sm text-black">Report Type: {selectedReport.matterType}</p>
              </div>
              <div className="mb-4 p-3 bg-pink-50 rounded-lg">
                <p className="text-gray-600">{selectedReport.description}</p>
              </div>
              <div className="text-sm text-black mb-4">
                <p>Email: {selectedReport.email}</p>
                <p>Phone: {selectedReport.phone}</p>
                <p>Status: {selectedReport.status}</p>
                <p>Submitted: {new Date(selectedReport.createdAt).toLocaleString()}</p>
                {selectedReport.resolvedAt && (
                  <p>Resolved: {new Date(selectedReport.resolvedAt).toLocaleString()}</p>
                )}
              </div>
              <div className="mt-4">
                <label htmlFor="response" className="block text-sm font-medium text-black mb-1">
                  Your Response:
                </label>
                <textarea
                  id="response"
                  className="w-full p-2 border rounded-md focus:ring-2 focus:ring-pink-300 focus:border-pink-300 outline-none text-black"
                  placeholder="Enter your response..."
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  rows={4}
                />
              </div>
              <div className="mt-4 flex gap-2">
                <button 
                  onClick={handleResponseSubmit}
                  className="px-4 py-2 bg-pink-600 text-white rounded-md hover:bg-pink-700 transition-colors"
                >
                  {selectedReport.status === 'resolved' ? 'Update Response' : 'Submit Response'}
                </button>
                <button 
                  onClick={() => handleBlockUser(selectedReport.userId)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
                >
                  Block User
                </button>
                <button 
                  onClick={() => setSelectedReport(null)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
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