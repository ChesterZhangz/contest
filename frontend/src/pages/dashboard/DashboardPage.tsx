import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Trophy,
  BookOpen,
  PlusCircle,
  LayoutDashboard,
  ChevronRight,
  Database,
  Swords,
  ClipboardList,
  Users,
} from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Loading } from '@/components/ui/Loading'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/store/auth'
import { banksService } from '@/services/banks'
import { contestsService } from '@/services/contests'
import type { UserRole, ContestStatus } from '@/types'

// ── Role badge ────────────────────────────────────────────────────────────

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple'

const ROLE_BADGE: Record<UserRole, { label: string; variant: BadgeVariant }> = {
  super_admin: { label: 'Super Admin', variant: 'error' },
  host: { label: 'Host', variant: 'purple' },
  judge: { label: 'Judge', variant: 'info' },
  participant: { label: 'Participant', variant: 'success' },
  audience: { label: 'Audience', variant: 'default' },
}

// ── Contest status badge ──────────────────────────────────────────────────

const STATUS_BADGE: Record<ContestStatus, { label: string; variant: BadgeVariant }> = {
  draft: { label: 'Draft', variant: 'default' },
  ready: { label: 'Ready', variant: 'warning' },
  active: { label: 'Active', variant: 'success' },
  finished: { label: 'Finished', variant: 'info' },
}

// ── Quick Action Card ─────────────────────────────────────────────────────

interface QuickActionProps {
  to: string
  icon: React.ReactNode
  title: string
  description: string
  color: string
}

function QuickAction({ to, icon, title, description, color }: QuickActionProps) {
  return (
    <Link to={to} className="block group">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 transition-all duration-200 hover:shadow-card-hover hover:-translate-y-0.5">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
          {icon}
        </div>
        <p className="font-semibold text-slate-800 text-sm group-hover:text-teal-600 transition-colors">
          {title}
        </p>
        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{description}</p>
      </div>
    </Link>
  )
}

// ── Stat Card ─────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: number | string
  icon: React.ReactNode
  color: string
  sublabel?: string
}

function StatCard({ label, value, icon, color, sublabel }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        <p className="text-sm text-slate-500 mt-0.5">{label}</p>
        {sublabel && <p className="text-xs text-slate-400 mt-0.5">{sublabel}</p>}
      </div>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const role = user?.role ?? 'audience'

  const isAdminOrHost = role === 'super_admin' || role === 'host'
  const isJudge = role === 'judge'
  const isAdmin = role === 'super_admin'

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: banks = [], isLoading: banksLoading } = useQuery({
    queryKey: ['banks'],
    queryFn: banksService.list,
  })

  const { data: contests = [], isLoading: contestsLoading } = useQuery({
    queryKey: ['contests'],
    queryFn: contestsService.list,
  })

  const activeContests = contests.filter((c) => c.status === 'active')
  const recentContests = [...contests]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3)
  const recentBanks = [...banks]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3)

  const roleBadge = ROLE_BADGE[role]

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto">

      {/* Greeting Card */}
      <div className="bg-gradient-to-br from-teal-600 to-teal-700 rounded-2xl p-6 text-white shadow-md">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <LayoutDashboard className="w-4 h-4 opacity-70" />
              <span className="text-teal-200 text-xs font-medium uppercase tracking-wide">
                {t('dashboard.overview', 'Overview')}
              </span>
            </div>
            <h1 className="text-2xl font-bold">
              {t('dashboard.greeting', '欢迎，{{name}}', { name: user?.displayName ?? user?.username ?? '—' })}
            </h1>
            <p className="text-teal-200 text-sm mt-1">
              {t('dashboard.greetingEn', 'Welcome back, {{name}}', { name: user?.displayName ?? user?.username ?? '—' })}
            </p>
          </div>
          <Badge variant={roleBadge.variant} className="shrink-0 mt-1">
            {roleBadge.label}
          </Badge>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {banksLoading ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 flex items-center justify-center">
            <Loading size="sm" className="py-0" />
          </div>
        ) : (
          <StatCard
            label={t('dashboard.questionBanks', '题库总数 / Question Banks')}
            value={banks.length}
            icon={<Database className="w-6 h-6 text-teal-600" />}
            color="bg-teal-50"
          />
        )}

        {contestsLoading ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 flex items-center justify-center">
            <Loading size="sm" className="py-0" />
          </div>
        ) : (
          <>
            <StatCard
              label={t('dashboard.totalContests', '竞赛总数 / Total Contests')}
              value={contests.length}
              icon={<Trophy className="w-6 h-6 text-amber-600" />}
              color="bg-amber-50"
            />
            <StatCard
              label={t('dashboard.activeContests', '进行中竞赛 / Active Contests')}
              value={activeContests.length}
              icon={<Swords className="w-6 h-6 text-emerald-600" />}
              color="bg-emerald-50"
              sublabel={activeContests.length > 0 ? t('dashboard.liveNow', 'Live now') : undefined}
            />
          </>
        )}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
          {t('dashboard.quickActions', 'Quick Actions')}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {isAdminOrHost && (
            <>
              <QuickAction
                to="/contests/new"
                icon={<Trophy className="w-5 h-5 text-amber-600" />}
                title={t('dashboard.createContest', '创建竞赛')}
                description={t('dashboard.createContestDesc', 'Create Contest')}
                color="bg-amber-50"
              />
              <QuickAction
                to="/banks"
                icon={<Database className="w-5 h-5 text-teal-600" />}
                title={t('dashboard.manageBanks', '管理题库')}
                description={t('dashboard.manageBanksDesc', 'Manage Banks')}
                color="bg-teal-50"
              />
            </>
          )}

          {isJudge && (
            <>
              <QuickAction
                to="/banks"
                icon={<BookOpen className="w-5 h-5 text-teal-600" />}
                title={t('dashboard.myBanks', '我的题库')}
                description={t('dashboard.myBanksDesc', 'My Banks')}
                color="bg-teal-50"
              />
              <QuickAction
                to="/contests"
                icon={<Swords className="w-5 h-5 text-emerald-600" />}
                title={t('dashboard.ongoingContests', '进行中竞赛')}
                description={t('dashboard.ongoingContestsDesc', 'Ongoing Contests')}
                color="bg-emerald-50"
              />
            </>
          )}

          {isAdmin && (
            <QuickAction
              to="/users"
              icon={<Users className="w-5 h-5 text-violet-600" />}
              title={t('dashboard.manageUsers', '用户管理')}
              description={t('dashboard.manageUsersDesc', 'Manage Users')}
              color="bg-violet-50"
            />
          )}

          <QuickAction
            to="/contests"
            icon={<ClipboardList className="w-5 h-5 text-slate-600" />}
            title={t('dashboard.allContests', '所有竞赛')}
            description={t('dashboard.allContestsDesc', 'View all contests')}
            color="bg-slate-100"
          />
        </div>
      </div>

      {/* Bottom Row — Recent Contests & Banks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Recent Contests */}
        <Card padding="none">
          <div className="px-5 pt-5 pb-4 border-b border-slate-50">
            <CardHeader
              title={t('dashboard.recentContests', '最近竞赛 / Recent Contests')}
              action={
                <Link to="/contests">
                  <Button variant="ghost" size="sm" icon={<ChevronRight className="w-3.5 h-3.5" />}>
                    {t('common.viewAll', 'View All')}
                  </Button>
                </Link>
              }
            />
          </div>
          {contestsLoading ? (
            <Loading size="sm" />
          ) : recentContests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
              <Trophy className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">{t('dashboard.noContests', 'No contests yet')}</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-50">
              {recentContests.map((contest) => {
                const sb = STATUS_BADGE[contest.status]
                return (
                  <li key={contest.id}>
                    <Link
                      to={`/contests/${contest.id}`}
                      className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/60 transition-colors group"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate group-hover:text-teal-600 transition-colors">
                          {contest.name}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {new Date(contest.createdAt).toLocaleDateString()}
                          {' · '}
                          {contest.mode === 'team'
                            ? t('contest.modeTeam', 'Team')
                            : t('contest.modeIndividual', 'Individual')}
                        </p>
                      </div>
                      <Badge variant={sb.variant} dot>
                        {sb.label}
                      </Badge>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        {/* Recent Banks */}
        <Card padding="none">
          <div className="px-5 pt-5 pb-4 border-b border-slate-50">
            <CardHeader
              title={t('dashboard.recentBanks', '最近题库 / Recent Banks')}
              action={
                <Link to="/banks">
                  <Button variant="ghost" size="sm" icon={<ChevronRight className="w-3.5 h-3.5" />}>
                    {t('common.viewAll', 'View All')}
                  </Button>
                </Link>
              }
            />
          </div>
          {banksLoading ? (
            <Loading size="sm" />
          ) : recentBanks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
              <Database className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">{t('dashboard.noBanks', 'No question banks yet')}</p>
              {isAdminOrHost && (
                <Link to="/banks/new" className="mt-3">
                  <Button variant="outline" size="sm" icon={<PlusCircle className="w-3.5 h-3.5" />}>
                    {t('dashboard.createBank', 'Create Bank')}
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-slate-50">
              {recentBanks.map((bank) => (
                <li key={bank.id}>
                  <Link
                    to={`/banks/${bank.id}`}
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/60 transition-colors group"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate group-hover:text-teal-600 transition-colors">
                        {bank.name}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {bank.questionCount} {t('bank.questions', 'questions')}
                        {' · '}
                        {bank.isPublic ? t('bank.public', 'Public') : t('bank.private', 'Private')}
                      </p>
                    </div>
                    <Badge variant={bank.isPublic ? 'success' : 'default'}>
                      {bank.isPublic ? t('bank.public', 'Public') : t('bank.private', 'Private')}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
