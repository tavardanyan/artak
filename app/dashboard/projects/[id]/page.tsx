"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Calendar,
  DollarSign,
  Users,
  FileText,
  Settings,
  Package,
  ClipboardList
} from "lucide-react"

// Sample project data
const projectData = {
  "1": {
    name: "Նախագիծ 1",
    status: "active",
    progress: 65,
    budget: 5000000,
    spent: 3250000,
    startDate: "2024-01-15",
    endDate: "2024-12-31",
    description: "Առաջին նախագծի նկարագրություն",
  },
  "2": {
    name: "Նախագիծ 2",
    status: "planning",
    progress: 30,
    budget: 3000000,
    spent: 900000,
    startDate: "2024-03-01",
    endDate: "2024-10-30",
    description: "Երկրորդ նախագծի նկարագրություն",
  },
  "3": {
    name: "Նախագիծ 3",
    status: "completed",
    progress: 100,
    budget: 2000000,
    spent: 1950000,
    startDate: "2023-06-01",
    endDate: "2024-02-28",
    description: "Երրորդ նախագծի նկարագրություն",
  },
}

const getStatusBadge = (status: string) => {
  const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    active: { label: "Ակտիվ", variant: "default" },
    planning: { label: "Պլանավորում", variant: "secondary" },
    completed: { label: "Ավարտված", variant: "outline" },
  }

  const statusInfo = statusMap[status] || { label: status, variant: "outline" as const }
  return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
}

export default function ProjectPage() {
  const params = useParams()
  const projectId = params.id as string
  const project = projectData[projectId as keyof typeof projectData]

  const [activeTab, setActiveTab] = useState("overview")

  if (!project) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Նախագիծը չի գտնվել</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Project Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h2 className="text-3xl font-bold tracking-tight">{project.name}</h2>
          {getStatusBadge(project.status)}
        </div>
        <p className="text-muted-foreground">{project.description}</p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="overview">Ընդհանուր</TabsTrigger>
          <TabsTrigger value="kataroxakan">Կատարողական</TabsTrigger>
          <TabsTrigger value="materials">Նյութեր</TabsTrigger>
          <TabsTrigger value="staff">Անձնակազմ</TabsTrigger>
          <TabsTrigger value="dates">Ժամկետներ</TabsTrigger>
          <TabsTrigger value="finance">Ֆինանսներ</TabsTrigger>
          <TabsTrigger value="settings">Կարգավորումներ</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Առաջընթաց</CardTitle>
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{project.progress}%</div>
                <Progress value={project.progress} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Բյուջե</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {project.budget.toLocaleString()} ֏
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Ծախսված՝ {project.spent.toLocaleString()} ֏
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Սկիզբ</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {new Date(project.startDate).toLocaleDateString('hy-AM')}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ավարտ</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {new Date(project.endDate).toLocaleDateString('hy-AM')}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Նախագծի մանրամասներ</CardTitle>
              <CardDescription>Նախագծի հիմնական տեղեկատվությունը</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Վիճակ</p>
                  <div className="mt-1">{getStatusBadge(project.status)}</div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Առաջընթաց</p>
                  <div className="mt-1">
                    <Progress value={project.progress} />
                    <p className="text-sm mt-1">{project.progress}% ավարտված</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Նախագծի տևողությունը</p>
                  <p className="text-sm mt-1">
                    {Math.ceil((new Date(project.endDate).getTime() - new Date(project.startDate).getTime()) / (1000 * 60 * 60 * 24))} օր
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Բյուջեի օգտագործում</p>
                  <p className="text-sm mt-1">
                    {((project.spent / project.budget) * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Kataroxakan Tab */}
        <TabsContent value="kataroxakan" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Կատարողական հաշվետվություն</CardTitle>
              <CardDescription>Նախագծի կատարման մանրամասներ</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Կատարողական հաշվետվության բովանդակությունը կավելացվի շուտով...
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Materials Tab */}
        <TabsContent value="materials" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Նյութական պաշարներ</CardTitle>
              <CardDescription>Նախագծում օգտագործվող նյութեր և սարքավորումներ</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Նյութերի ցանկը կավելացվի շուտով...
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Staff Tab */}
        <TabsContent value="staff" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Նախագծի անձնակազմ</CardTitle>
              <CardDescription>Նախագծում ներգրավված աշխատակիցներ</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Անձնակազմի ցանկը կավելացվի շուտով...
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Dates Tab */}
        <TabsContent value="dates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ժամկետներ և փուլեր</CardTitle>
              <CardDescription>Նախագծի ժամանակացույց և կարևոր ամսաթվեր</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-4 border-b">
                  <div>
                    <p className="font-medium">Սկիզբ</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(project.startDate).toLocaleDateString('hy-AM', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                  <Badge variant="outline">Սկսված</Badge>
                </div>
                <div className="flex items-center justify-between pb-4 border-b">
                  <div>
                    <p className="font-medium">Ավարտ</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(project.endDate).toLocaleDateString('hy-AM', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                  <Badge variant="secondary">Ընթացքում</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Finance Tab */}
        <TabsContent value="finance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Ընդհանուր բյուջե</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{project.budget.toLocaleString()} ֏</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Ծախսված</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{project.spent.toLocaleString()} ֏</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {((project.spent / project.budget) * 100).toFixed(1)}% բյուջեից
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Ֆինանսական հաշվետվություն</CardTitle>
              <CardDescription>Ծախսերի և եկամուտների մանրամասներ</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">Բյուջեի օգտագործում</p>
                    <p className="text-sm text-muted-foreground">
                      {((project.spent / project.budget) * 100).toFixed(1)}%
                    </p>
                  </div>
                  <Progress value={(project.spent / project.budget) * 100} />
                </div>
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Մնացորդ</p>
                    <p className="text-lg font-bold">
                      {(project.budget - project.spent).toLocaleString()} ֏
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Նախագծի կարգավորումներ</CardTitle>
              <CardDescription>Նախագծի հիմնական կարգավորումներ և պարամետրեր</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Կարգավորումների բաժինը կավելացվի շուտով...
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
