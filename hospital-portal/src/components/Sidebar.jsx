/**
 * Side navigation. Live routes: Dashboard, Patients, Add Patient, Org Users &
 * Invites, Org Settings, Referral Feedback. "Switch organization" jumps back to
 * the org window.
 */
import { NavLink } from 'react-router-dom'
import {
  BarChart3,
  Building2,
  MessageSquareText,
  Repeat,
  Settings,
  UserPlus,
  Users,
} from 'lucide-react'

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { to: '/patients', label: 'Patients', icon: Users },
  { to: '/patients/new', label: 'Add Patient', icon: UserPlus },
  { divider: 'Organization' },
  { to: '/org-users', label: 'Org Users & Invites', icon: Building2 },
  { to: '/org-settings', label: 'Org Settings', icon: Settings },
  { to: '/referral-feedback', label: 'Referral Feedback', icon: MessageSquareText },
  { to: '/select-org', label: 'Switch organization', icon: Repeat },
]

function itemClass({ isActive }) {
  return [
    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-accent text-foreground'
      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
  ].join(' ')
}

export default function Sidebar({ onNavigate }) {
  return (
    <nav className="flex h-full flex-col gap-1 p-3" aria-label="Primary">
      {NAV.map((item, i) => {
        if (item.divider) {
          return (
            <div
              key={`divider-${i}`}
              className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70"
            >
              {item.divider}
            </div>
          )
        }
        const Icon = item.icon
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/patients'}
            className={itemClass}
            onClick={onNavigate}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1">{item.label}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}
