import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Zap, BarChart2, Settings, Cpu, Menu } from 'lucide-react'

const links = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/devices', icon: Cpu, label: 'Devices' },
  { to: '/modes', icon: Zap, label: 'Modes' },
  { to: '/history', icon: BarChart2, label: 'History' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar_collapsed')
    return saved !== null ? JSON.parse(saved) : true
  })

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev
      localStorage.setItem('sidebar_collapsed', JSON.stringify(next))
      return next
    })
  }

  return (
    <aside
      className={`${
        isCollapsed ? 'w-16' : 'w-56'
      } bg-surface flex flex-col border-r border-white/5 min-h-screen transition-all duration-200 shrink-0`}
    >
      <div className={`p-4 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} border-b border-white/5`}>
        {!isCollapsed && (
          <span className="text-primary font-bold text-lg tracking-tight truncate">
            Zendure Cloudless
          </span>
        )}
        <button
          onClick={toggleCollapse}
          className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-colors"
          title={isCollapsed ? 'Déplier le menu' : 'Replier le menu'}
          aria-label="Toggle menu"
        >
          <Menu size={20} />
        </button>
      </div>
      <nav className="flex flex-col gap-1 p-2 mt-2">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            title={isCollapsed ? label : undefined}
            className={({ isActive }) =>
              `flex items-center ${
                isCollapsed ? 'justify-center px-2' : 'gap-3 px-3'
              } py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`
            }
          >
            <Icon size={18} className="shrink-0" />
            {!isCollapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
