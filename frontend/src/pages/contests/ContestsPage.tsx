import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Plus, Trophy, LogIn, Copy, Check, Share2 } from 'lucide-react'
import { clsx } from 'clsx'
import { contestsService } from '@/services/contests'
import { ContestCard } from '@/components/contest/ContestCard'
import { Button } from '@/components/ui/Button'
import { Loading } from '@/components/ui/Loading'
import { ConfirmDialog } from '@/components/ui/Modal'
import { useAuthStore } from '@/store/auth'
import { useToast } from '@/hooks/useToast'
import type { Contest, ContestStatus } from '@/types'
import { getContestAccess } from '@/utils/contestAccess'

type FilterTab = 'all' | ContestStatus
type TeamJoinOption = { id: string; name: string; color: string; memberCount?: number }

const FILTER_TABS: { key: FilterTab; zh: string; en: string }[] = [
  { key: 'all', zh: '全部', en: 'All' },
  { key: 'draft', zh: '草稿', en: 'Draft' },
  { key: 'ready', zh: '就绪', en: 'Ready' },
  { key: 'active', zh: '进行中', en: 'Active' },
  { key: 'finished', zh: '已结束', en: 'Finished' },
]

export default function ContestsPage() {
  const { i18n } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const user = useAuthStore((s) => s.user)

  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [deleteTarget, setDeleteTarget] = useState<Contest | null>(null)
  const [startingId, setStartingId] = useState<string | null>(null)
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [joiningContest, setJoiningContest] = useState<Contest | null>(null)
  const [joinCode, setJoinCode] = useState('')
  const [joinLoading, setJoinLoading] = useState(false)
  const [joinTeamOptions, setJoinTeamOptions] = useState<TeamJoinOption[]>([])
  const [teamOptionsFromCode, setTeamOptionsFromCode] = useState(false)
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [joinContestName, setJoinContestName] = useState('')
  const [showCodeContest, setShowCodeContest] = useState<Contest | null>(null)
  const [fetchedCode, setFetchedCode] = useState('')
  const [codeCopied, setCodeCopied] = useState(false)
  const joinInputRef = useRef<HTMLInputElement>(null)

  const canManage = user?.role === 'host' || user?.role === 'super_admin'

  const resetJoinState = () => {
    setJoinCode('')
    setJoinTeamOptions([])
    setTeamOptionsFromCode(false)
    setSelectedTeamId('')
    setJoinContestName('')
    setJoiningContest(null)
  }

  const closeJoinModal = () => {
    setShowJoinModal(false)
    resetJoinState()
  }

  const openJoinModal = (contest?: Contest) => {
    setShowJoinModal(true)
    resetJoinState()
    setJoiningContest(contest ?? null)

    if (contest?.mode === 'team' && contest.teams.length > 0) {
      const teamOptions = contest.teams.map((team) => ({
        id: String(team.id),
        name: String(team.name),
        color: String(team.color ?? '#94a3b8'),
        memberCount: Array.isArray(team.memberIds) ? team.memberIds.length : 0,
      }))
      setJoinTeamOptions(teamOptions)
      setTeamOptionsFromCode(false)
      // Pre-select the team the user is already assigned to (if any)
      const assignedTeamId = contest.teams.find(
        (t) => Array.isArray(t.memberIds) && t.memberIds.some((id) => String(id) === String(user?.id))
      )?.id
      setSelectedTeamId(assignedTeamId ? String(assignedTeamId) : teamOptions[0]?.id ?? '')
      setJoinContestName(contest.name)
    }

    setTimeout(() => joinInputRef.current?.focus(), 50)
  }

  const { data: contests = [], isLoading, error } = useQuery({
    queryKey: ['contests'],
    queryFn: contestsService.list,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => contestsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contests'] })
      toast.success(i18n.language === 'zh' ? '竞赛已删除' : 'Contest deleted')
      setDeleteTarget(null)
    },
    onError: () => {
      toast.error(i18n.language === 'zh' ? '删除失败' : 'Failed to delete contest')
    },
  })

  const handleStart = async (contest: Contest) => {
    setStartingId(contest.id)
    try {
      const { sessionId } = await contestsService.start(contest.id)
      queryClient.invalidateQueries({ queryKey: ['contests'] })
      navigate(`/session/${sessionId}/host?contestId=${contest.id}`)
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
      toast.error(message || (i18n.language === 'zh' ? '启动竞赛失败' : 'Failed to start contest'))
    } finally {
      setStartingId(null)
    }
  }

  const handleJoin = async () => {
    if (!joinCode.trim()) return
    if (joinTeamOptions.length > 0 && !selectedTeamId) {
      toast.error(lang === 'zh' ? '请先选择队伍' : 'Please select a team first')
      return
    }

    setJoinLoading(true)
    try {
      const joined = await contestsService.join(joinCode.trim(), joinTeamOptions.length > 0 ? selectedTeamId : undefined)
      queryClient.invalidateQueries({ queryKey: ['contests'] })
      closeJoinModal()
      if (joined.status === 'active') {
        handleView(joined)
      } else {
        toast.success(lang === 'zh' ? '成功加入竞赛，等待比赛开始' : 'Successfully joined. Waiting for the contest to start.')
      }
    } catch (err: unknown) {
      const errorData = (err as { response?: { data?: { error?: { code?: string; details?: unknown } } } })?.response?.data?.error
      const code = errorData?.code
      const details = (errorData?.details ?? {}) as {
        contestName?: string
        teams?: Array<{ id?: string; name?: string; color?: string; memberCount?: number }>
      }

      if (code === 'TEAM_SELECTION_REQUIRED' && Array.isArray(details.teams) && details.teams.length > 0) {
        const teams = details.teams
          .filter((team) => team.id && team.name)
          .map((team) => ({
            id: String(team.id),
            name: String(team.name),
            color: String(team.color ?? '#94a3b8'),
            memberCount: typeof team.memberCount === 'number' ? team.memberCount : undefined,
          }))

        if (teams.length > 0) {
          setJoinTeamOptions(teams)
          setTeamOptionsFromCode(true)
          setSelectedTeamId(teams[0].id)
          setJoinContestName(details.contestName ? String(details.contestName) : '')
          toast.error(lang === 'zh' ? '这是团队赛，请先选择队伍' : 'This is a team contest. Please select a team first.')
          return
        }
      }

      if (code === 'ALREADY_JOINED') {
        if (joiningContest?.status === 'active') {
          closeJoinModal()
          handleView(joiningContest)
        } else {
          toast.error(lang === 'zh' ? '您已加入该竞赛，等待比赛开始' : 'You have already joined this contest. Waiting for it to start.')
        }
      } else if (code === 'TEAM_NOT_FOUND') {
        toast.error(lang === 'zh' ? '所选队伍不存在，请重新选择' : 'Selected team not found. Please choose again.')
        setJoinTeamOptions([])
        setTeamOptionsFromCode(false)
        setSelectedTeamId('')
      } else if (code === 'TEAM_NOT_AVAILABLE') {
        toast.error(lang === 'zh' ? '当前比赛暂无可加入队伍' : 'No teams are available for this contest')
      } else if (
        code === 'NOT_ENROLLED' ||
        code === 'ACCESS_DENIED' ||
        code === 'FORBIDDEN' ||
        code === 'PARTICIPANT_LIST_CLOSED' ||
        code === 'NOT_IN_PARTICIPANT_LIST'
      ) {
        toast.error(lang === 'zh' ? '您不在参赛名单中，无法加入此竞赛' : 'You are not on the participant list for this contest')
      } else if (code === 'CONTEST_FINISHED') {
        toast.error(lang === 'zh' ? '该竞赛已结束，无法加入' : 'This contest has already ended')
      } else if (code === 'CONTEST_NOT_FOUND') {
        toast.error(lang === 'zh' ? '竞赛不存在，邀请码可能已失效' : 'Contest not found. The invite code may have expired.')
      } else {
        toast.error(lang === 'zh' ? '邀请码无效或已过期' : 'Invalid or expired invite code')
      }
    } finally {
      setJoinLoading(false)
    }
  }

  const handleShowCode = async (contest: Contest) => {
    setShowCodeContest(contest)
    setFetchedCode('')
    setCodeCopied(false)
    try {
      const { joinCode: code } = await contestsService.getJoinCode(contest.id)
      setFetchedCode(code)
    } catch {
      toast.error(lang === 'zh' ? '获取邀请码失败' : 'Failed to get invite code')
      setShowCodeContest(null)
    }
  }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(fetchedCode).then(() => {
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 2000)
    })
  }

  const handleView = async (contest: Contest) => {
    try {
      const { sessionId } = await contestsService.getSession(contest.id)
      const access = getContestAccess(contest, user)

      if (access.isManagerForContest) {
        navigate(`/session/${sessionId}/host?contestId=${contest.id}`)
      } else if (access.isJudgeForContest) {
        navigate(`/session/${sessionId}/judge?contestId=${contest.id}`)
      } else {
        navigate(`/session/${sessionId}/audience?contestId=${contest.id}`)
      }
    } catch {
      toast.error(i18n.language === 'zh' ? '无法获取比赛现场信息' : 'Failed to get session info')
    }
  }

  const filtered = activeTab === 'all'
    ? contests
    : contests.filter((c) => c.status === activeTab)

  const lang = i18n.language === 'zh' ? 'zh' : 'en'

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center shadow-sm">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">
              {i18n.language === 'zh' ? '竞赛管理' : 'Contests'}
            </h1>
            <p className="text-sm text-slate-500">
              {i18n.language === 'zh'
                ? `共 ${contests.length} 场竞赛`
                : `${contests.length} contest${contests.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!canManage && (
            <Button
              variant="outline"
              icon={<LogIn className="w-4 h-4" />}
              onClick={() => openJoinModal()}
            >
              {i18n.language === 'zh' ? '加入竞赛' : 'Join Contest'}
            </Button>
          )}
          {canManage && (
            <Button
              variant="primary"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => navigate('/contests/new')}
            >
              {i18n.language === 'zh' ? '创建竞赛' : 'Create Contest'}
            </Button>
          )}
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {FILTER_TABS.map((tab) => {
          const count = tab.key === 'all'
            ? contests.length
            : contests.filter((c) => c.status === tab.key).length
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={clsx(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all duration-150',
                activeTab === tab.key
                  ? 'bg-white text-teal-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              {lang === 'zh' ? tab.zh : tab.en}
              <span
                className={clsx(
                  'text-xs px-1.5 py-0.5 rounded-full',
                  activeTab === tab.key
                    ? 'bg-teal-50 text-teal-600'
                    : 'bg-slate-200 text-slate-500'
                )}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Content */}
      {isLoading ? (
        <Loading />
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <p className="text-slate-400 text-sm">
            {i18n.language === 'zh' ? '加载失败，请刷新页面' : 'Failed to load contests. Please refresh.'}
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
            <Trophy className="w-8 h-8 text-slate-300" />
          </div>
          <div className="text-center">
            <p className="font-medium text-slate-500">
              {i18n.language === 'zh' ? '暂无竞赛' : 'No contests yet'}
            </p>
            <p className="text-sm text-slate-400 mt-1">
              {canManage
                ? i18n.language === 'zh' ? '点击「创建竞赛」开始' : 'Click "Create Contest" to get started'
                : i18n.language === 'zh' ? '等待主持人创建竞赛' : 'Waiting for a contest to be created'
              }
            </p>
          </div>
          {canManage && (
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => navigate('/contests/new')}
            >
              {i18n.language === 'zh' ? '创建竞赛' : 'Create Contest'}
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((contest) => {
            const { isManagerForContest, shouldJoinInsteadOfView } = getContestAccess(contest, user)

            return (
              <div key={contest.id} className="relative">
                {startingId === contest.id && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/70 backdrop-blur-sm">
                    <div className="flex items-center gap-2 text-teal-600 text-sm font-medium">
                      <div className="w-4 h-4 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                      {i18n.language === 'zh' ? '启动中…' : 'Starting…'}
                    </div>
                  </div>
                )}
                <ContestCard
                  contest={contest}
                  onEdit={isManagerForContest ? () => navigate(`/contests/${contest.id}/edit`) : undefined}
                  onDelete={isManagerForContest ? () => setDeleteTarget(contest) : undefined}
                  onStart={isManagerForContest ? () => handleStart(contest) : undefined}
                  onView={shouldJoinInsteadOfView ? undefined : () => handleView(contest)}
                  onJoin={shouldJoinInsteadOfView ? () => openJoinModal(contest) : undefined}
                  onShowCode={isManagerForContest ? () => handleShowCode(contest) : undefined}
                />
              </div>
            )
          })}
        </div>
      )}

      {/* Delete confirm dialog */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        loading={deleteMutation.isPending}
        danger
        title={i18n.language === 'zh' ? '删除竞赛' : 'Delete Contest'}
        message={
          i18n.language === 'zh'
            ? `确定要删除竞赛「${deleteTarget?.name}」吗？此操作无法撤销。`
            : `Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`
        }
        confirmLabel={i18n.language === 'zh' ? '确认删除' : 'Delete'}
        cancelLabel={i18n.language === 'zh' ? '取消' : 'Cancel'}
      />

      {/* Join Contest Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeJoinModal}
          />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center">
                <LogIn className="w-5 h-5 text-teal-600" />
              </div>
              <div>
                <h2 className="font-bold text-slate-800">{lang === 'zh' ? '加入竞赛' : 'Join Contest'}</h2>
                <p className="text-xs text-slate-500">
                  {joinTeamOptions.length > 0
                    ? lang === 'zh'
                      ? `请选择队伍${joinContestName ? `（${joinContestName}）` : ''}`
                      : `Choose a team${joinContestName ? ` (${joinContestName})` : ''}`
                    : lang === 'zh' ? '输入主持人提供的邀请码' : 'Enter the invite code from the host'}
                </p>
              </div>
            </div>
            <input
              ref={joinInputRef}
              type="text"
              value={joinCode}
              onChange={(e) => {
                setJoinCode(e.target.value.toUpperCase())
                if (teamOptionsFromCode && joinTeamOptions.length > 0) {
                  setJoinTeamOptions([])
                  setTeamOptionsFromCode(false)
                  setSelectedTeamId('')
                  setJoinContestName('')
                }
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              placeholder={lang === 'zh' ? '输入 8 位邀请码' : 'Enter 8-character code'}
              maxLength={8}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-center text-2xl font-bold text-slate-800 tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
            {joinTeamOptions.length > 0 && (
              <div className="flex flex-col gap-2">
                {joinTeamOptions.map((team) => (
                  <label
                    key={team.id}
                    className={clsx(
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors',
                      selectedTeamId === team.id
                        ? 'border-teal-300 bg-teal-50'
                        : 'border-slate-200 hover:bg-slate-50'
                    )}
                  >
                    <input
                      type="radio"
                      name="join-team"
                      checked={selectedTeamId === team.id}
                      onChange={() => setSelectedTeamId(team.id)}
                      className="w-4 h-4 text-teal-600 border-slate-300 focus:ring-teal-500"
                    />
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: team.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{team.name}</p>
                      <p className="text-xs text-slate-400">
                        {lang === 'zh'
                          ? `成员 ${team.memberCount ?? 0} 人`
                          : `${team.memberCount ?? 0} member${(team.memberCount ?? 0) === 1 ? '' : 's'}`}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={closeJoinModal}
              >
                {lang === 'zh' ? '取消' : 'Cancel'}
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                loading={joinLoading}
                onClick={handleJoin}
                disabled={joinCode.trim().length < 4 || (joinTeamOptions.length > 0 && !selectedTeamId)}
              >
                {joinTeamOptions.length > 0
                  ? lang === 'zh' ? '确认加入' : 'Confirm'
                  : lang === 'zh' ? '加入' : 'Join'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Show Invite Code Modal */}
      {showCodeContest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCodeContest(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
                <Share2 className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <h2 className="font-bold text-slate-800">{lang === 'zh' ? '邀请码' : 'Invite Code'}</h2>
                <p className="text-xs text-slate-500 truncate max-w-48">{showCodeContest.name}</p>
              </div>
            </div>

            {fetchedCode ? (
              <>
                <div className="bg-slate-50 rounded-2xl border border-slate-200 py-6 flex flex-col items-center gap-2">
                  <span className="text-4xl font-extrabold text-slate-800 tracking-widest">{fetchedCode}</span>
                  <p className="text-xs text-slate-500">{lang === 'zh' ? '将此邀请码分享给参赛者' : 'Share this code with participants'}</p>
                </div>
                <button
                  onClick={handleCopyCode}
                  className={clsx(
                    'flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                    codeCopied
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                  )}
                >
                  {codeCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {codeCopied
                    ? lang === 'zh' ? '已复制！' : 'Copied!'
                    : lang === 'zh' ? '复制邀请码' : 'Copy Code'}
                </button>
              </>
            ) : (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            <Button variant="ghost" onClick={() => setShowCodeContest(null)}>
              {lang === 'zh' ? '关闭' : 'Close'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
