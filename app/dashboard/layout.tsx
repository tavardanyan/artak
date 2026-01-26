"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Bell, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TaxSyncProvider } from "@/providers/tax-sync-provider"
import { useTaxSync } from "@/hooks/use-tax-sync"
import { useRouter } from "next/navigation"

function DashboardHeader() {
  const router = useRouter()
  const { unseenCount, timeAgo, syncSettings, syncing } = useTaxSync()

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem className="hidden md:block">
            <BreadcrumbLink href="/dashboard">
              Dashboard
            </BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ml-auto flex items-center gap-2">
        {/* Tax Sync Status */}
        {syncSettings?.lastSyncDate && (
          <Button
            variant="ghost"
            size="sm"
            className="relative gap-2"
            onClick={() => router.push("/dashboard/taxservice")}
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin text-primary' : ''}`} />
            <span className="text-xs text-muted-foreground">{syncing ? 'Սինքրոնացվում է...' : timeAgo}</span>
            {unseenCount > 0 && (
              <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                {unseenCount}
              </Badge>
            )}
          </Button>
        )}
        <ThemeToggle />
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-600" />
          <span className="sr-only">Notifications</span>
        </Button>
      </div>
    </header>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <TaxSyncProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <DashboardHeader />
          <div className="flex flex-1 flex-col gap-4 p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TaxSyncProvider>
  )
}
