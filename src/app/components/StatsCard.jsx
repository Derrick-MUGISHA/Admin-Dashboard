export default function StatsCard({ title, value, trend, icon }) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">{title}</p>
            <p className="mt-2 text-3xl font-semibold text-gray-900">{value}</p>
          </div>
          <div className={`p-3 rounded-full ${icon.bgColor}`}>
            <icon.component className={`w-6 h-6 ${icon.textColor}`} />
          </div>
        </div>
        {trend && (
          <div className="mt-4 flex items-center text-sm">
            <span className={`${trend.color} font-medium`}>
              {trend.value}%
            </span>
            <span className="ml-2 text-gray-500">{trend.label}</span>
          </div>
        )}
      </div>
    )
  }