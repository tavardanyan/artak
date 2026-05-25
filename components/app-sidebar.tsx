"use client"

import * as React from "react"
import {
  LayoutDashboard,
  Users,
  Settings,
  FileText,
  DollarSign,
  Calendar,
  Warehouse,
  FolderOpen,
  Receipt,
  ChevronRight,
  MoreHorizontal,
  Folder,
  Handshake,
  Plus,
  Contact,
  Package,
  AlertCircle,
  TruckIcon,
  PackageCheck,
  UserCog,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { useRouter, usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { CreateOrderDrawer } from "@/components/create-order-drawer"
import { CreateTransactionDrawer } from "@/components/create-transaction-drawer"
import { CreateProjectDrawer } from "@/components/create-project-drawer"
import { TransactionDetailDrawer } from "@/components/transaction-detail-drawer"

const mainNavItems = [
  {
    title: "Ընդհանուր",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Աշխատակազմ",
    url: "/dashboard/staff",
    icon: Users,
  },
  {
    title: "Ֆինանսներ",
    url: "/dashboard/finance",
    icon: DollarSign,
  },
  {
    title: "Օրացույց",
    url: "/dashboard/calendar",
    icon: Calendar,
  },
  {
    title: "Պահեստ",
    url: "/dashboard/warehouse",
    icon: Warehouse,
  },
  {
    title: "Ապրանքներ",
    url: "/dashboard/items",
    icon: Package,
  },
  {
    title: "Գործընկերներ",
    url: "/dashboard/partners",
    icon: Handshake,
  },
  {
    title: "Կոնտակտներ",
    url: "/dashboard/contacts",
    icon: Contact,
  },
  {
    title: "Փաստաթղթեր",
    url: "/dashboard/documents",
    icon: FolderOpen,
  },
  {
    title: "Հարկային ծառայություն",
    url: "/dashboard/taxservice",
    icon: Receipt,
  },
  {
    title: "Օգտատերեր",
    url: "/dashboard/users",
    icon: UserCog,
  },
  {
    title: "Կարգավորումներ",
    url: "/dashboard/configs",
    icon: Settings,
  },
]

interface Project {
  id: number
  name: string
  code: string
  status: string
  parent_project: number | null
}

export function AppSidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [isOrderDrawerOpen, setIsOrderDrawerOpen] = React.useState(false)
  const [isTransactionDrawerOpen, setIsTransactionDrawerOpen] = React.useState(false)
  const [createdTransactionId, setCreatedTransactionId] = React.useState<number | null>(null)
  const [isTransactionDetailOpen, setIsTransactionDetailOpen] = React.useState(false)
  const [isProjectDrawerOpen, setIsProjectDrawerOpen] = React.useState(false)
  const [activeProjects, setActiveProjects] = React.useState<Project[]>([])
  const [uncheckedCounts, setUncheckedCounts] = React.useState({ items: 0, invoices: 0, transfers: 0, draftTransfers: 0 })

  React.useEffect(() => {
    fetchActiveProjects()
    fetchUncheckedCounts()
  }, [])

  const fetchUncheckedCounts = async () => {
    const [items, invoices, transfers, draftTransfers] = await Promise.all([
      supabase.from("item").select("*", { count: "exact", head: true }).is("parent", null).or("seen.is.null,seen.eq.false"),
      supabase.from("invoice").select("*", { count: "exact", head: true }).eq("seen", false),
      supabase.from("transfer").select("*", { count: "exact", head: true }).eq("to", 114),
      supabase.from("transfer").select("*", { count: "exact", head: true }).is("delivered_at", null).is("acepted_at", null).is("rejected_at", null),
    ])
    setUncheckedCounts({
      items: items.count || 0,
      invoices: invoices.count || 0,
      transfers: transfers.count || 0,
      draftTransfers: draftTransfers.count || 0,
    })
  }

  const fetchActiveProjects = async () => {
    const { data, error } = await supabase
      .from("project")
      .select("id, name, code, status, parent_project")
      .eq("status", "active")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching active projects:", error.message, error.details, error.hint)
      return
    }

    setActiveProjects(data || [])
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  const handlePartnerSelected = (partnerId: number, warehouseId: number, accountId: number) => {
    // Store the transfer data in sessionStorage to pass to the warehouse page
    sessionStorage.setItem('pendingTransfer', JSON.stringify({
      fromWarehouse: warehouseId,
      toWarehouse: null,
      createTransaction: true,
      fromAccount: null,
      toAccount: accountId,
      openDrawer: true
    }))
    router.push(`/dashboard/warehouse?id=${warehouseId}`)
  }

  const handleProjectCreated = () => {
    // Refresh the active projects list after creating a new project
    fetchActiveProjects()
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary p-1">
                  <img src="/logo.svg" alt="ԼՈՒՍԻ-ԱՐԵԳ" className="size-full object-contain" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">ԼՈՒՍԻ-ԱՐԵԳ</span>
                  <span className="truncate text-xs">Կառավարման համակարգ</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="w-full" size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Ստեղծել
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem onClick={() => setIsOrderDrawerOpen(true)}>
                  Գնում
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsTransactionDrawerOpen(true)}>
                  Ստեղծել գործարք
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsProjectDrawerOpen(true)}>
                  Ստեղծել նախագիծ
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                  >
                    <a href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Չստուգված</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/dashboard/unchecked/items"}>
                  <a href="/dashboard/unchecked/items">
                    <Package />
                    <span>Ապրանքներ</span>
                    {uncheckedCounts.items > 0 && <span className="ml-auto text-xs text-muted-foreground">{uncheckedCounts.items}</span>}
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/dashboard/unchecked/invoices"}>
                  <a href="/dashboard/unchecked/invoices">
                    <Receipt />
                    <span>Հաշիվ ապրանքագրեր</span>
                    {uncheckedCounts.invoices > 0 && <span className="ml-auto text-xs text-muted-foreground">{uncheckedCounts.invoices}</span>}
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/dashboard/unchecked/transfers"}>
                  <a href="/dashboard/unchecked/transfers">
                    <TruckIcon />
                    <span>Փոխանցումներ</span>
                    {uncheckedCounts.transfers > 0 && <span className="ml-auto text-xs text-muted-foreground">{uncheckedCounts.transfers}</span>}
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/dashboard/unchecked/draft-transfers"}>
                  <a href="/dashboard/unchecked/draft-transfers">
                    <PackageCheck />
                    <span>Տեղափոխումներ</span>
                    {uncheckedCounts.draftTransfers > 0 && <span className="ml-auto text-xs text-muted-foreground">{uncheckedCounts.draftTransfers}</span>}
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Ակտիվ նախագծեր</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {activeProjects.length > 0 ? (
                activeProjects
                  .filter(p => !p.parent_project)
                  .map((project) => {
                    const subProjects = activeProjects.filter(p => p.parent_project === project.id)
                    return (
                      <React.Fragment key={project.id}>
                        <SidebarMenuItem>
                          <SidebarMenuButton
                            asChild
                            isActive={pathname === `/dashboard/projects/${project.id}`}
                            className="h-auto min-h-8 items-start py-1.5 [&>span:last-child]:!whitespace-normal [&>span:last-child]:line-clamp-2 [&>span:last-child]:leading-snug"
                          >
                            <a href={`/dashboard/projects/${project.id}`}>
                              <Folder className="mt-0.5" />
                              <span>{project.name}</span>
                            </a>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                        {subProjects.map((sub) => (
                          <SidebarMenuItem key={sub.id}>
                            <SidebarMenuButton
                              asChild
                              isActive={pathname === `/dashboard/projects/${sub.id}`}
                              className="pl-8 h-auto min-h-8 items-start py-1.5 [&>span:last-child]:!whitespace-normal [&>span:last-child]:line-clamp-2 [&>span:last-child]:leading-snug"
                            >
                              <a href={`/dashboard/projects/${sub.id}`}>
                                <Folder className="h-3 w-3 mt-0.5" />
                                <span className="text-sm">{sub.name}</span>
                              </a>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        ))}
                      </React.Fragment>
                    )
                  })
              ) : (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  Ակտիվ նախագծեր չկան
                </div>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarFallback className="rounded-lg">AD</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">Admin User</span>
                    <span className="truncate text-xs">admin@example.com</span>
                  </div>
                  <MoreHorizontal className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="bottom"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuItem>
                  <span>Անձնական էջ</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <span>Կարգավորումներ</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <span>Դուրս գալ</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      {/* Order Creation Drawer */}
      <CreateOrderDrawer
        open={isOrderDrawerOpen}
        onOpenChange={setIsOrderDrawerOpen}
        onPartnerSelected={handlePartnerSelected}
      />

      {/* Transaction Creation Drawer */}
      <CreateTransactionDrawer
        open={isTransactionDrawerOpen}
        onOpenChange={setIsTransactionDrawerOpen}
        onSuccess={(transactionId) => {
          if (transactionId) {
            setCreatedTransactionId(transactionId)
            setIsTransactionDetailOpen(true)
          }
        }}
      />

      {/* Transaction Detail Drawer (opened after creation) */}
      <TransactionDetailDrawer
        open={isTransactionDetailOpen}
        onOpenChange={setIsTransactionDetailOpen}
        transactionId={createdTransactionId}
      />

      {/* Project Creation Drawer */}
      <CreateProjectDrawer
        open={isProjectDrawerOpen}
        onOpenChange={setIsProjectDrawerOpen}
        onSuccess={handleProjectCreated}
      />
    </Sidebar>
  )
}
