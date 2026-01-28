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
    title: "Հաշվետվություններ",
    url: "/dashboard/reports",
    icon: FileText,
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
    title: "Նախագծեր",
    url: "/dashboard/projects",
    icon: Folder,
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
}

export function AppSidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [isOrderDrawerOpen, setIsOrderDrawerOpen] = React.useState(false)
  const [isTransactionDrawerOpen, setIsTransactionDrawerOpen] = React.useState(false)
  const [isProjectDrawerOpen, setIsProjectDrawerOpen] = React.useState(false)
  const [activeProjects, setActiveProjects] = React.useState<Project[]>([])

  React.useEffect(() => {
    fetchActiveProjects()
  }, [])

  const fetchActiveProjects = async () => {
    const { data, error } = await supabase
      .from("project")
      .select("id, name, code, status")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(10)

    if (error) {
      console.error("Error fetching active projects:", error)
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
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <LayoutDashboard className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Ադմին Փանել</span>
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
          <SidebarGroupLabel>Գլխավոր</SidebarGroupLabel>
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
          <SidebarGroupLabel>Ակտիվ նախագծեր</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {activeProjects.length > 0 ? (
                activeProjects.map((project) => (
                  <SidebarMenuItem key={project.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === `/dashboard/projects/${project.id}`}
                    >
                      <a href={`/dashboard/projects/${project.id}`}>
                        <Folder />
                        <span>{project.name}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
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
                    <AvatarImage src="/avatars/01.png" alt="Admin" />
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
