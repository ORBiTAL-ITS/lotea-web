'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Printer,
  Receipt,
  Search,
  Trash2,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { MagicCard } from '@/components/ui/magic-card'
import { BorderBeam } from '@/components/ui/border-beam'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import {
  useEffectiveCompanyId,
  clearStoredCompanyId,
} from '@/features/session/hooks/use-effective-company-id'
import { useAppSelector } from '@/shared/store/hooks'
import { selectSessionUser } from '@/features/session/models/session-selectors'
import { fetchCompanyById } from '@/features/companies/services/companies-service'
import { CompanyPickerSection } from '@/features/companies/components/company-picker-section'
import {
  GASTOS_PROJECT_DOC_ID,
  isGastosProjectId,
} from '@/features/projects/constants/gastos-project'
import {
  ensureGastosProject,
  fetchProjects,
} from '@/features/projects/services/projects-service'
import type { Project } from '@/features/projects/models/project-types'
import type { Movement, MovementKind } from '../models/movement-types'
import {
  backfillProjectInvoiceNumbers,
  deleteMovement,
  fetchMovements,
} from '../services/movements-service'
import {
  LOTEA_MOVEMENTS_UPDATED_EVENT,
  notifyMovementsUpdated,
} from '../movements-events'
import {
  formatMovementDay,
  movementDateForAccounting,
  formatMovementInvoice,
  movementInCalendarMonth,
  movementMatchesQuery,
  moneyFmt,
  sortMovementsForTable,
  type MovementTableSort,
} from '../utils/movements-display'
import { QuickNewMovementButton } from './quick-new-movement-button'
import { EditMovementDialog } from './edit-movement-dialog'
import { MovementInvoiceDialog } from './movement-invoice-dialog'
import { MonthYearFilter } from './month-year-filter'

const MOVEMENTS_PAGE_SIZE = 5

const copy: Record<
  MovementKind,
  {
    title: string
    description: string
    emptyCard: string
    listTitle: string
    searchPh: string
  }
> = {
  income: {
    title: 'Ingresos',
    description:
      'Cada registro es un comprobante con numeración I-1, I-2… por proyecto; puedes imprimirlo desde Acciones. Fecha contable, lote u opcional. Elige proyecto y mes (opcional), Buscar información, refina por texto y usa +.',
    emptyCard: 'Para ver ingresos necesitas una empresa activa.',
    listTitle: 'Ingresos en este proyecto',
    searchPh: 'Buscar en ingresos…',
  },
  expense: {
    title: 'Egresos',
    description:
      'Elige «Gasto» para un egreso general de la empresa (solo concepto y monto; comprobante E-1, E-2… con numeración propia). O elige un proyecto para imputar a lotes con tope según saldo. Fecha contable, mes opcional, Buscar información y +.',
    emptyCard: 'Para ver egresos necesitas una empresa activa.',
    listTitle: 'Egresos en este proyecto',
    searchPh: 'Buscar en egresos…',
  },
}

export function MovementsKindPage({ kind }: { kind: MovementKind }) {
  const user = useAppSelector(selectSessionUser)
  const [tick, setTick] = useState(0)
  const { companyId } = useEffectiveCompanyId(tick)
  const [companySnapshot, setCompanySnapshot] = useState<{
    id: string
    name: string | null
  } | null>(null)

  const [projects, setProjects] = useState<Project[]>([])
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [loadedProject, setLoadedProject] = useState<Project | null>(null)
  const [movements, setMovements] = useState<Movement[]>([])
  const [loadingSearch, setLoadingSearch] = useState(false)
  const [panelError, setPanelError] = useState<string | null>(null)
  const [movementsFilter, setMovementsFilter] = useState('')
  /** '' = todos los meses; 'yyyy-mm' para filtrar. */
  const [monthFilter, setMonthFilter] = useState('')
  const [movementsPage, setMovementsPage] = useState(1)
  const [editingMovement, setEditingMovement] = useState<Movement | null>(null)
  const [invoiceMovement, setInvoiceMovement] = useState<Movement | null>(null)
  const [deletingMovement, setDeletingMovement] = useState<Movement | null>(null)
  const [deletingLoading, setDeletingLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [backfillLoading, setBackfillLoading] = useState(false)
  const [invoiceBackfillFeedback, setInvoiceBackfillFeedback] = useState<{
    variant: 'success' | 'error'
    text: string
  } | null>(null)
  const [movementTableSort, setMovementTableSort] = useState<MovementTableSort>({
    kind: 'date',
    dir: 'desc',
  })

  const t = copy[kind]

  const projectSelectItems = useMemo(() => {
    const rows = projects.map(p => ({
      value: p.id,
      label: (
        <>
          <span className='truncate font-medium'>{p.name}</span>
          <span className='shrink-0 text-xs text-muted-foreground tabular-nums'>
            {p.code}
          </span>
        </>
      ),
    }))
    if (kind === 'expense') {
      return [
        {
          value: GASTOS_PROJECT_DOC_ID,
          label: <span className='font-medium'>Gasto</span>,
        },
        ...rows,
      ]
    }
    return rows
  }, [projects, kind])

  useEffect(() => {
    if (!companyId) return
    let cancelled = false
    void fetchCompanyById(companyId).then(c => {
      if (!cancelled) setCompanySnapshot({ id: companyId, name: c?.name ?? null })
    })
    return () => {
      cancelled = true
    }
  }, [companyId])

  const loadProjects = useCallback(async () => {
    if (!companyId) {
      setProjects([])
      return
    }
    setLoadingProjects(true)
    try {
      let fetched: Project[] = []
      try {
        fetched = await fetchProjects(companyId)
      } catch {
        fetched = []
      }
      if (kind === 'expense') {
        setProjects(fetched.filter(p => !isGastosProjectId(p.id)))
      } else {
        setProjects(fetched)
      }
    } finally {
      setLoadingProjects(false)
    }
  }, [companyId, kind])

  useEffect(() => {
    void loadProjects()
  }, [loadProjects, tick])

  const reloadMovements = useCallback(async () => {
    if (!companyId || !projectId || !loadedProject || loadedProject.id !== projectId)
      return
    try {
      setMovements(await fetchMovements(companyId, projectId))
    } catch {
      /* silencio */
    }
  }, [companyId, projectId, loadedProject])

  useEffect(() => {
    const bump = () => void reloadMovements()
    window.addEventListener(LOTEA_MOVEMENTS_UPDATED_EVENT, bump)
    return () => window.removeEventListener(LOTEA_MOVEMENTS_UPDATED_EVENT, bump)
  }, [reloadMovements])

  const ofKind = useMemo(() => movements.filter(m => m.kind === kind), [movements, kind])

  const byMonth = useMemo(
    () => ofKind.filter(m => movementInCalendarMonth(m, monthFilter)),
    [ofKind, monthFilter]
  )

  const filteredMovements = useMemo(() => {
    const arr = byMonth.filter((m) =>
      movementMatchesQuery(m, movementsFilter, { activeMonthKey: monthFilter }),
    )
    return sortMovementsForTable(arr, movementTableSort)
  }, [byMonth, movementsFilter, monthFilter, movementTableSort])

  const movementsTotalPages = Math.max(
    1,
    Math.ceil(filteredMovements.length / MOVEMENTS_PAGE_SIZE)
  )
  const movementsPageSafe = Math.min(movementsPage, movementsTotalPages)

  const pagedMovements = useMemo(() => {
    const start = (movementsPageSafe - 1) * MOVEMENTS_PAGE_SIZE
    return filteredMovements.slice(start, start + MOVEMENTS_PAGE_SIZE)
  }, [filteredMovements, movementsPageSafe])

  useEffect(() => {
    setMovementsPage(1)
  }, [monthFilter, movementsFilter, loadedProject?.id, kind, movementTableSort])

  useEffect(() => {
    setMovementsPage(p => Math.min(p, movementsTotalPages))
  }, [movementsTotalPages])

  const companyName =
    companyId && companySnapshot?.id === companyId ? companySnapshot.name : null

  const listTitleResolved =
    kind === 'expense' && loadedProject && isGastosProjectId(loadedProject.id)
      ? 'Egresos en Gasto (general)'
      : t.listTitle

  const isMaster = user?.globalRole === 'master'
  const canSwitchCompany = isMaster
  const isViewer = user?.companyRole === 'viewer'
  const isCompanyAdmin =
    user?.globalRole === 'company_user' && user?.companyRole === 'admin'
  const canMutateMovements = Boolean(user) && !isViewer && (isMaster || isCompanyAdmin)
  const showMovementActions = Boolean(user && loadedProject)

  const someInvoicesMissing = useMemo(
    () =>
      movements.some(
        m =>
          !(
            typeof m.invoiceNumber === 'number' &&
            Number.isInteger(m.invoiceNumber) &&
            m.invoiceNumber >= 1
          )
      ),
    [movements]
  )

  async function handleSearchProject() {
    if (loadingSearch) return
    if (!companyId || !projectId) {
      setPanelError(kind === 'expense' ? 'Elige Gasto o un proyecto.' : 'Elige un proyecto.')
      return
    }

    if (kind === 'expense' && isGastosProjectId(projectId)) {
      setPanelError(null)
      setLoadingSearch(true)
      setMovementsFilter('')
      try {
        const ensured = await ensureGastosProject(companyId)
        if (!ensured) {
          setLoadedProject(null)
          setMovements([])
          setPanelError(
            'No se pudo usar «Gasto». Un administrador debe abrir Egresos una vez para activarlo, o revisa permisos y conexión.',
          )
          return
        }
        setLoadedProject(ensured)
        const list = await fetchMovements(companyId, projectId)
        setMovements(list)
      } catch {
        setMovements([])
        setLoadedProject(null)
        setPanelError('No se pudo cargar los movimientos (¿permisos o índice Firestore?).')
      } finally {
        setLoadingSearch(false)
      }
      return
    }

    const proj = projects.find(p => p.id === projectId)
    if (!proj) {
      setPanelError('Proyecto no encontrado.')
      return
    }
    setPanelError(null)
    setLoadingSearch(true)
    setLoadedProject(proj)
    setMovementsFilter('')
    try {
      const list = await fetchMovements(companyId, projectId)
      setMovements(list)
    } catch {
      setMovements([])
      setPanelError('No se pudo cargar los movimientos (¿permisos o índice Firestore?).')
    } finally {
      setLoadingSearch(false)
    }
  }

  async function handleConfirmDelete() {
    if (deletingLoading) return
    if (!companyId || !loadedProject || !deletingMovement) return
    setDeleteError(null)
    setDeletingLoading(true)
    try {
      await deleteMovement(companyId, loadedProject.id, deletingMovement.id)
      setDeletingMovement(null)
      notifyMovementsUpdated()
      await reloadMovements()
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : 'No se pudo eliminar el movimiento.'
      )
    } finally {
      setDeletingLoading(false)
    }
  }

  async function handleBackfillInvoices() {
    if (backfillLoading) return
    if (!companyId || !loadedProject) return
    setInvoiceBackfillFeedback(null)
    setBackfillLoading(true)
    try {
      const r = await backfillProjectInvoiceNumbers(companyId, loadedProject.id)
      setInvoiceBackfillFeedback({
        variant: 'success',
        text:
          r.assigned > 0
            ? `Se asignaron ${r.assigned} número(s) de factura (último ingreso I-${r.incomeLast}, último egreso E-${r.expenseLast}).`
            : 'Todos los movimientos ya tenían número; contadores sincronizados.',
      })
      await reloadMovements()
      notifyMovementsUpdated()
    } catch (err) {
      setInvoiceBackfillFeedback({
        variant: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'No se pudo completar la asignación de facturas.',
      })
    } finally {
      setBackfillLoading(false)
    }
  }

  return (
    <div className='w-full px-4 py-6 sm:px-6 md:px-8 lg:px-10 xl:px-12 lg:py-8 xl:py-10'>
      <div className='mx-auto w-full max-w-7xl 2xl:max-w-[90rem]'>
        <div className='flex w-full flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-6 lg:gap-8'>
          <div className='min-w-0 flex-1 space-y-2 sm:max-w-2xl lg:max-w-3xl xl:max-w-4xl'>
            <h1 className='font-heading text-2xl font-semibold tracking-tight sm:text-3xl'>
              {t.title}
            </h1>
            <p className='max-w-prose text-pretty text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem]'>
              {t.description}
            </p>
          </div>
          <div className='flex shrink-0 flex-wrap items-center gap-2 sm:justify-end'>
            {canSwitchCompany && companyId ? (
              <Button
                variant='outline'
                size='sm'
                onClick={() => {
                  clearStoredCompanyId()
                  setTick(t => t + 1)
                }}>
                Cambiar empresa
              </Button>
            ) : null}
            {companyId ? (
              <QuickNewMovementButton
                companyId={companyId}
                kind={kind}
                pageProjectId={projectId}
                pageLoadedProject={loadedProject}
                syncedProjectId={
                  loadedProject && projectId === loadedProject.id
                    ? loadedProject.id
                    : null
                }
                syncedProjectMovements={
                  loadedProject && projectId === loadedProject.id ? movements : undefined
                }
                onCreated={() => void reloadMovements()}
              />
            ) : null}
          </div>
        </div>

        <div className='mt-8 space-y-6 sm:mt-10 lg:space-y-8'>
          {!companyId ? (
            isMaster ? (
              <CompanyPickerSection
                revision={tick}
                onCompanySelected={() => setTick(t => t + 1)}
              />
            ) : (
              <Card className='border-border/80'>
                <CardHeader>
                  <CardTitle className='text-base'>{t.title}</CardTitle>
                  <CardDescription>{t.emptyCard}</CardDescription>
                </CardHeader>
              </Card>
            )
          ) : (
            <>
              <Card className='border-border/80 bg-muted/15'>
                <CardContent className='px-4 py-5 sm:px-6 sm:py-6'>
                  <p className='text-sm sm:text-[0.9375rem]'>
                    <span className='text-muted-foreground'>Empresa activa: </span>
                    <span className='font-medium text-foreground'>
                      {companyName ?? '…'}
                    </span>
                  </p>
                </CardContent>
              </Card>

              <div className='space-y-4'>
                {panelError ? (
                  <p className='text-sm text-destructive' role='alert'>
                    {panelError}
                  </p>
                ) : null}

                <div className='flex flex-col gap-4 lg:flex-row lg:items-end lg:gap-5'>
                  <div className='min-w-0 flex-1 space-y-2 lg:min-w-[min(100%,20rem)]'>
                    <Label htmlFor={`mov-page-project-${kind}`}>
                      {kind === 'expense' ? 'Registrar en' : 'Proyecto'}
                    </Label>
                    <Select
                      value={projectId}
                      items={projectSelectItems}
                      onValueChange={v => {
                        setProjectId(v)
                        setLoadedProject(null)
                        setMovements([])
                        setMovementsFilter('')
                        setMonthFilter('')
                        setPanelError(null)
                      }}
                      disabled={loadingProjects}
                      modal={false}>
                      <SelectTrigger
                        id={`mov-page-project-${kind}`}
                        size='default'
                        className='h-10 w-full min-w-0 max-w-full [&_[data-slot=select-value]]:text-left'>
                        <SelectValue
                          placeholder={
                            loadingProjects
                              ? 'Cargando…'
                              : kind === 'expense'
                                ? 'Elige Gasto o un proyecto'
                                : 'Elige un proyecto'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent
                        align='start'
                        sideOffset={6}
                        alignItemWithTrigger={false}>
                        {kind === 'expense' ? (
                          <>
                            <SelectItem value={GASTOS_PROJECT_DOC_ID}>
                              <span className='font-medium'>Gasto</span>
                            </SelectItem>
                            {projects.map(p => (
                              <SelectItem key={p.id} value={p.id}>
                                <span className='truncate font-medium'>{p.name}</span>
                                <span className='shrink-0 text-xs text-muted-foreground tabular-nums'>
                                  {p.code}
                                </span>
                              </SelectItem>
                            ))}
                          </>
                        ) : projects.length === 0 && !loadingProjects ? (
                          <div className='px-3 py-4 text-xs text-muted-foreground'>
                            No hay proyectos en esta empresa.
                          </div>
                        ) : (
                          projects.map(p => (
                            <SelectItem key={p.id} value={p.id}>
                              <span className='truncate font-medium'>{p.name}</span>
                              <span className='shrink-0 text-xs text-muted-foreground tabular-nums'>
                                {p.code}
                              </span>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className='w-full sm:w-auto sm:min-w-[14rem]'>
                    <MonthYearFilter
                      idYear={`mov-year-${kind}`}
                      idMonth={`mov-month-${kind}`}
                      value={monthFilter}
                      onChange={setMonthFilter}
                      disabled={!projectId || loadingProjects}
                    />
                  </div>
                  <Button
                    type='button'
                    variant='secondary'
                    className='h-10 w-full shrink-0 gap-2 sm:w-auto sm:min-w-[10.5rem] lg:min-w-[12rem]'
                    disabled={!projectId || loadingSearch}
                    onClick={() => void handleSearchProject()}>
                    {loadingSearch ? (
                      <Loader2 className='h-4 w-4 animate-spin' />
                    ) : (
                      <Search className='h-4 w-4' />
                    )}
                    Buscar información
                  </Button>
                </div>

                <AnimatePresence initial={false}>
                  {loadedProject ? (
                    <motion.div
                      key='loaded'
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                      className='space-y-5 sm:space-y-6'>
                      <MagicCard className='relative overflow-hidden rounded-xl border border-border/80 bg-card/90 p-4 shadow-sm backdrop-blur-sm sm:p-5 lg:p-6'>
                        <BorderBeam size={64} duration={10} borderWidth={1} />
                        <div className='relative z-10 space-y-1'>
                          <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                            {isGastosProjectId(loadedProject.id)
                              ? 'Tipo de egreso'
                              : 'Proyecto seleccionado'}
                          </p>
                          <p className='font-heading text-lg font-semibold sm:text-xl lg:text-2xl'>
                            {isGastosProjectId(loadedProject.id) ? 'Gasto' : loadedProject.name}
                          </p>
                          <p className='text-sm text-muted-foreground sm:text-[0.9375rem]'>
                            {isGastosProjectId(loadedProject.id) ? (
                              <>
                                Egreso general de la empresa: solo concepto y monto. Comprobantes
                                E-1, E-2… con numeración aparte de los proyectos.
                              </>
                            ) : (
                              <>
                                Código{' '}
                                <span className='font-mono text-foreground'>
                                  {loadedProject.code}
                                </span>
                                {' · '}
                                {loadedProject.lotCount} lotes ·{' '}
                                <Badge
                                  variant={
                                    loadedProject.status === 'active'
                                      ? 'default'
                                      : 'secondary'
                                  }>
                                  {loadedProject.status === 'active' ? 'Activo' : 'Cerrado'}
                                </Badge>
                              </>
                            )}
                          </p>
                        </div>
                      </MagicCard>

                      <div className='overflow-hidden rounded-xl border border-border/80 bg-muted/20'>
                        <div className='flex flex-col gap-3 border-b border-border/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5 sm:py-4'>
                          <p className='text-xs font-medium text-muted-foreground sm:text-sm'>
                            {listTitleResolved}
                            {byMonth.length > 0
                              ? ` · ${filteredMovements.length}/${byMonth.length}`
                              : ''}
                            {monthFilter ? (
                              <span className='text-muted-foreground/90'>
                                {' '}
                                (mes filtrado)
                              </span>
                            ) : null}
                          </p>
                          <div className='flex min-w-0 w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end lg:gap-3'>
                            {canMutateMovements && loadedProject && ofKind.length > 0 ? (
                              <Button
                                type='button'
                                variant='outline'
                                size='sm'
                                className='h-9 w-full shrink-0 gap-1.5 sm:w-auto'
                                disabled={backfillLoading}
                                title={
                                  someInvoicesMissing
                                    ? 'Asigna números I-/E- a movimientos que no tienen factura y sincroniza contadores'
                                    : 'Sincroniza contadores de factura con los números ya guardados'
                                }
                                onClick={() => void handleBackfillInvoices()}>
                                {backfillLoading ? (
                                  <Loader2 className='h-3.5 w-3.5 animate-spin' />
                                ) : (
                                  <Receipt className='h-3.5 w-3.5' />
                                )}
                                Facturas antiguas
                              </Button>
                            ) : null}
                            {ofKind.length > 0 ? (
                              <div className='relative w-full min-w-0 sm:min-w-[12rem] sm:max-w-xs md:max-w-sm lg:max-w-md xl:max-w-lg'>
                                <Search className='pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground' />
                                <Input
                                  aria-label={t.searchPh}
                                  placeholder={t.searchPh}
                                  value={movementsFilter}
                                  onChange={e => setMovementsFilter(e.target.value)}
                                  className='h-9 w-full pl-9'
                                />
                              </div>
                            ) : null}
                          </div>
                        </div>
                        {invoiceBackfillFeedback ? (
                          <p
                            className={
                              invoiceBackfillFeedback.variant === 'error'
                                ? 'border-t border-border/60 px-4 py-2 text-sm text-destructive sm:px-5'
                                : 'border-t border-border/60 px-4 py-2 text-sm text-muted-foreground sm:px-5'
                            }
                            {...(invoiceBackfillFeedback.variant === 'error'
                              ? { role: 'alert' as const }
                              : { 'aria-live': 'polite' as const })}>
                            {invoiceBackfillFeedback.text}
                          </p>
                        ) : null}
                        {ofKind.length === 0 ? (
                          <p className='px-4 py-8 text-center text-sm text-muted-foreground sm:px-6 sm:py-10 sm:text-[0.9375rem]'>
                            {kind === 'income'
                              ? 'Aún no hay ingresos registrados en este proyecto.'
                              : isGastosProjectId(loadedProject.id)
                                ? 'Aún no hay egresos en Gasto.'
                                : 'Aún no hay egresos registrados en este proyecto.'}
                          </p>
                        ) : filteredMovements.length === 0 ? (
                          <p className='px-4 py-8 text-center text-sm text-muted-foreground sm:px-6 sm:py-10 sm:text-[0.9375rem]'>
                            {byMonth.length === 0 && monthFilter
                              ? 'No hay movimientos en ese mes y año. Revisa el año en el campo Mes (muchas planillas son 2025) o déjalo vacío para ver todos.'
                              : movementsFilter.trim()
                                ? `Ningún registro coincide con «${movementsFilter.trim()}».`
                                : 'No hay registros en el mes seleccionado.'}
                          </p>
                        ) : (
                          <>
                            <div className='max-h-[min(52vh,420px)] overflow-auto sm:max-h-[min(58vh,520px)] lg:max-h-[min(70vh,680px)]'>
                              <Table className='min-w-[36rem] sm:min-w-0'>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className='whitespace-nowrap sm:pl-4 lg:pl-5'>
                                      <DropdownMenu>
                                        <DropdownMenuTrigger
                                          type='button'
                                          className={cn(
                                            '-ml-1 flex max-w-full items-center gap-1 rounded-md px-1.5 py-1 text-left font-semibold hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                            movementTableSort.kind === 'date' &&
                                              'text-foreground',
                                          )}>
                                          <span className='min-w-0'>Fecha mov.</span>
                                          <ChevronDown
                                            className='size-4 shrink-0 opacity-70'
                                            aria-hidden
                                          />
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align='start' className='min-w-[15rem]'>
                                          <DropdownMenuGroup>
                                            <DropdownMenuLabel>
                                              Ordenar por fecha contable
                                            </DropdownMenuLabel>
                                            <DropdownMenuItem
                                              className='gap-2'
                                              onClick={() =>
                                                setMovementTableSort({
                                                  kind: 'date',
                                                  dir: 'desc',
                                                })
                                              }>
                                              <Check
                                                className={cn(
                                                  'size-4 shrink-0',
                                                  movementTableSort.kind === 'date' &&
                                                    movementTableSort.dir === 'desc'
                                                    ? 'opacity-100'
                                                    : 'opacity-0',
                                                )}
                                                aria-hidden
                                              />
                                              Reciente primero
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                              className='gap-2'
                                              onClick={() =>
                                                setMovementTableSort({ kind: 'date', dir: 'asc' })
                                              }>
                                              <Check
                                                className={cn(
                                                  'size-4 shrink-0',
                                                  movementTableSort.kind === 'date' &&
                                                    movementTableSort.dir === 'asc'
                                                    ? 'opacity-100'
                                                    : 'opacity-0',
                                                )}
                                                aria-hidden
                                              />
                                              Antiguo primero
                                            </DropdownMenuItem>
                                          </DropdownMenuGroup>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </TableHead>
                                    <TableHead className='whitespace-nowrap'>
                                      <DropdownMenu>
                                        <DropdownMenuTrigger
                                          type='button'
                                          className={cn(
                                            '-ml-1 flex max-w-full items-center gap-1 rounded-md px-1.5 py-1 text-left font-semibold hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                            movementTableSort.kind === 'invoice' &&
                                              'text-foreground',
                                          )}>
                                          <span className='min-w-0'>Factura</span>
                                          <ChevronDown
                                            className='size-4 shrink-0 opacity-70'
                                            aria-hidden
                                          />
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align='start' className='min-w-[15rem]'>
                                          <DropdownMenuGroup>
                                            <DropdownMenuLabel>
                                              Ordenar por número de factura
                                            </DropdownMenuLabel>
                                            <DropdownMenuItem
                                              className='gap-2'
                                              onClick={() =>
                                                setMovementTableSort({
                                                  kind: 'invoice',
                                                  dir: 'asc',
                                                })
                                              }>
                                              <Check
                                                className={cn(
                                                  'size-4 shrink-0',
                                                  movementTableSort.kind === 'invoice' &&
                                                    movementTableSort.dir === 'asc'
                                                    ? 'opacity-100'
                                                    : 'opacity-0',
                                                )}
                                                aria-hidden
                                              />
                                              {kind === 'income'
                                                ? 'Menor número primero (I-1, I-2…)'
                                                : 'Menor número primero (E-1, E-2…)'}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                              className='gap-2'
                                              onClick={() =>
                                                setMovementTableSort({
                                                  kind: 'invoice',
                                                  dir: 'desc',
                                                })
                                              }>
                                              <Check
                                                className={cn(
                                                  'size-4 shrink-0',
                                                  movementTableSort.kind === 'invoice' &&
                                                    movementTableSort.dir === 'desc'
                                                    ? 'opacity-100'
                                                    : 'opacity-0',
                                                )}
                                                aria-hidden
                                              />
                                              Mayor número primero
                                            </DropdownMenuItem>
                                          </DropdownMenuGroup>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </TableHead>
                                    <TableHead className='min-w-20 text-center'>
                                      Lote
                                    </TableHead>
                                    <TableHead className='min-w-[7rem]'>
                                      Persona
                                    </TableHead>
                                    {kind === 'income' ? (
                                      <TableHead className='min-w-[6.5rem] whitespace-nowrap text-right tabular-nums'>
                                        Valor lote
                                      </TableHead>
                                    ) : null}
                                    <TableHead className='min-w-[10rem] lg:min-w-[14rem]'>
                                      Concepto
                                    </TableHead>
                                    <TableHead className='whitespace-nowrap text-right tabular-nums'>
                                      Monto
                                    </TableHead>
                                    {showMovementActions ? (
                                      <TableHead className='w-[1%] whitespace-nowrap pr-4 text-right sm:pr-5'>
                                        Acciones
                                      </TableHead>
                                    ) : null}
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {pagedMovements.map(m => (
                                    <TableRow key={m.id}>
                                      <TableCell className='whitespace-nowrap text-muted-foreground sm:pl-4 lg:pl-5'>
                                        {formatMovementDay(movementDateForAccounting(m))}
                                      </TableCell>
                                      <TableCell className='font-mono text-sm tabular-nums'>
                                        {formatMovementInvoice(m)}
                                      </TableCell>
                                      <TableCell className='text-center text-sm'>
                                        {m.linkedToLot && m.lotNumber !== null ? (
                                          <span className='tabular-nums font-medium'>
                                            {m.lotNumber}
                                          </span>
                                        ) : (
                                          <span className='text-muted-foreground'>
                                            General
                                          </span>
                                        )}
                                      </TableCell>
                                      <TableCell className='max-w-[10rem] truncate text-sm text-muted-foreground sm:max-w-[14rem]'>
                                        {m.linkedToLot && m.personName?.trim() ? (
                                          <span className='font-medium text-foreground' title={m.personName.trim()}>
                                            {m.personName.trim()}
                                          </span>
                                        ) : (
                                          '—'
                                        )}
                                      </TableCell>
                                      {kind === 'income' ? (
                                        <TableCell className='whitespace-nowrap text-right text-sm tabular-nums text-muted-foreground'>
                                          {m.linkedToLot &&
                                          m.lotValue != null &&
                                          m.lotValue > 0
                                            ? moneyFmt.format(m.lotValue)
                                            : '—'}
                                        </TableCell>
                                      ) : null}
                                      <TableCell className='min-w-0 max-w-[12rem] break-words font-medium sm:max-w-[18rem] md:max-w-none lg:py-3'>
                                        {m.concept}
                                      </TableCell>
                                      <TableCell className='whitespace-nowrap text-right tabular-nums lg:py-3'>
                                        {moneyFmt.format(m.amount)}
                                      </TableCell>
                                      {showMovementActions ? (
                                        <TableCell className='pr-2 text-right sm:pr-4 lg:pr-5'>
                                          <div className='flex flex-wrap items-center justify-end gap-1'>
                                            <Button
                                              type='button'
                                              variant='ghost'
                                              size='icon'
                                              className='h-8 w-8 shrink-0'
                                              title='Comprobante / imprimir'
                                              aria-label={`Comprobante ${formatMovementInvoice(m)} — ${m.concept}`}
                                              disabled={deletingLoading}
                                              onClick={() => setInvoiceMovement(m)}>
                                              <Printer className='h-4 w-4' />
                                            </Button>
                                            {canMutateMovements ? (
                                              <>
                                                <Button
                                                  type='button'
                                                  variant='ghost'
                                                  size='icon'
                                                  className='h-8 w-8 shrink-0'
                                                  aria-label={`Editar ${m.concept}`}
                                                  disabled={deletingLoading}
                                                  onClick={() => setEditingMovement(m)}>
                                                  <Pencil className='h-4 w-4' />
                                                </Button>
                                                <Button
                                                  type='button'
                                                  variant='ghost'
                                                  size='icon'
                                                  className='h-8 w-8 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive'
                                                  aria-label={`Eliminar ${m.concept}`}
                                                  disabled={deletingLoading}
                                                  onClick={() => {
                                                    setDeleteError(null)
                                                    setDeletingMovement(m)
                                                  }}>
                                                  <Trash2 className='h-4 w-4' />
                                                </Button>
                                              </>
                                            ) : null}
                                          </div>
                                        </TableCell>
                                      ) : null}
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                            <div className='flex flex-col gap-3 border-t border-border/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5'>
                              <p className='text-xs text-muted-foreground sm:text-sm'>
                                Mostrando{' '}
                                <span className='tabular-nums font-medium text-foreground'>
                                  {(movementsPageSafe - 1) * MOVEMENTS_PAGE_SIZE + 1}–
                                  {Math.min(
                                    movementsPageSafe * MOVEMENTS_PAGE_SIZE,
                                    filteredMovements.length
                                  )}
                                </span>{' '}
                                de{' '}
                                <span className='tabular-nums font-medium text-foreground'>
                                  {filteredMovements.length}
                                </span>
                                {movementsTotalPages > 1 ? (
                                  <span className='text-muted-foreground/90'>
                                    {' '}
                                    · Página {movementsPageSafe} de {movementsTotalPages}
                                  </span>
                                ) : null}
                              </p>
                              <div className='flex items-center justify-end gap-2'>
                                <Button
                                  type='button'
                                  variant='outline'
                                  size='sm'
                                  className='h-9 gap-1'
                                  disabled={movementsPageSafe <= 1}
                                  onClick={() =>
                                    setMovementsPage(p => Math.max(1, p - 1))
                                  }
                                  aria-label='Página anterior'>
                                  <ChevronLeft className='h-4 w-4' />
                                  Anterior
                                </Button>
                                <Button
                                  type='button'
                                  variant='outline'
                                  size='sm'
                                  className='h-9 gap-1'
                                  disabled={movementsPageSafe >= movementsTotalPages}
                                  onClick={() =>
                                    setMovementsPage(p =>
                                      Math.min(movementsTotalPages, p + 1)
                                    )
                                  }
                                  aria-label='Página siguiente'>
                                  Siguiente
                                  <ChevronRight className='h-4 w-4' />
                                </Button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                {loadedProject && companyId ? (
                  <>
                    <MovementInvoiceDialog
                      open={invoiceMovement !== null}
                      onOpenChange={open => {
                        if (!open) setInvoiceMovement(null)
                      }}
                      companyName={companyName}
                      project={loadedProject}
                      movement={invoiceMovement}
                    />
                    <EditMovementDialog
                      open={editingMovement !== null}
                      onOpenChange={open => {
                        if (!open) setEditingMovement(null)
                      }}
                      companyId={companyId}
                      projectId={loadedProject.id}
                      project={loadedProject}
                      projectMovements={movements}
                      kind={kind}
                      movement={editingMovement}
                      onSaved={() => void reloadMovements()}
                    />
                    <Dialog
                      open={deletingMovement !== null}
                      onOpenChange={open => {
                        if (!open) {
                          setDeletingMovement(null)
                          setDeleteError(null)
                        }
                      }}>
                      <DialogContent className='sm:max-w-md' showCloseButton>
                        <DialogHeader>
                          <DialogTitle>Eliminar movimiento</DialogTitle>
                          <DialogDescription>
                            Esta acción no se puede deshacer. ¿Quieres eliminar el
                            registro{' '}
                            <span className='font-medium text-foreground'>
                              «{deletingMovement?.concept ?? ''}»
                            </span>{' '}
                            por{' '}
                            <span className='tabular-nums font-medium text-foreground'>
                              {deletingMovement
                                ? moneyFmt.format(deletingMovement.amount)
                                : ''}
                            </span>
                            ?
                          </DialogDescription>
                        </DialogHeader>
                        {deleteError ? (
                          <p className='text-sm text-destructive' role='alert'>
                            {deleteError}
                          </p>
                        ) : null}
                        <DialogFooter className='gap-2 sm:justify-end'>
                          <Button
                            type='button'
                            variant='outline'
                            disabled={deletingLoading}
                            onClick={() => {
                              setDeletingMovement(null)
                              setDeleteError(null)
                            }}>
                            Cancelar
                          </Button>
                          <Button
                            type='button'
                            variant='destructive'
                            disabled={deletingLoading || !deletingMovement}
                            onClick={() => void handleConfirmDelete()}>
                            {deletingLoading ? (
                              <>
                                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                Eliminando…
                              </>
                            ) : (
                              'Eliminar'
                            )}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
