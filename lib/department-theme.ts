export type DeptTheme = {
  sidebarBg: string
  border: string
  textMuted: string
  switchLink: string
  buttonBg: string
  buttonHoverBg: string
  navActiveBg: string
  navInactiveText: string
  navHoverBg: string
  groupInactiveText: string
}

const FIRE_THEME: DeptTheme = {
  sidebarBg: 'bg-red-800',
  border: 'border-red-700',
  textMuted: 'text-red-300',
  switchLink: 'text-red-200',
  buttonBg: 'bg-red-700',
  buttonHoverBg: 'hover:bg-red-600',
  navActiveBg: 'bg-red-900',
  navInactiveText: 'text-red-100',
  navHoverBg: 'hover:bg-red-700',
  groupInactiveText: 'text-red-200',
}

const NAVY_THEME: DeptTheme = {
  sidebarBg: 'bg-blue-900',
  border: 'border-blue-800',
  textMuted: 'text-blue-300',
  switchLink: 'text-blue-200',
  buttonBg: 'bg-blue-800',
  buttonHoverBg: 'hover:bg-blue-700',
  navActiveBg: 'bg-blue-950',
  navInactiveText: 'text-blue-100',
  navHoverBg: 'hover:bg-blue-700',
  groupInactiveText: 'text-blue-200',
}

export function getDeptTheme(departmentType: string): DeptTheme {
  return departmentType === 'fire' ? FIRE_THEME : NAVY_THEME
}

export function getDeptBrandName(departmentType: string): string {
  switch (departmentType) {
    case 'fire':
      return 'FireOps7'
    case 'law_enforcement':
      return 'PoliceOps'
    default:
      return 'MuniOps'
  }
}
