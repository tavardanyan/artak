"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Phone, Mail, MapPin, Calendar, DollarSign, FileText } from "lucide-react"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

// Extended staff data with contract information
const staffData = {
  all: [
    {
      id: 1,
      name: "Արամ Պետրոսյան",
      position: "Գերագույն Մենեջեր",
      department: "Գրասենյակ",
      phone: "+374 91 123456",
      email: "aram.petrosyan@example.com",
      location: "Երևան",
      avatar: "",
      status: "active",
      startDate: "2023-01-15",
      birthDate: "1985-03-20",
      address: "Երևան, Մաշտոցի 25",
      contract: {
        totalAmount: 500000,
        paidAmount: 350000,
        monthlyPayment: 50000,
        payments: [
          { date: "2024-01-01", amount: 50000, status: "paid" },
          { date: "2024-02-01", amount: 50000, status: "paid" },
          { date: "2024-03-01", amount: 50000, status: "paid" },
          { date: "2024-04-01", amount: 50000, status: "paid" },
          { date: "2024-05-01", amount: 50000, status: "paid" },
          { date: "2024-06-01", amount: 50000, status: "paid" },
          { date: "2024-07-01", amount: 50000, status: "paid" },
          { date: "2024-08-01", amount: 50000, status: "pending" },
        ]
      }
    },
    {
      id: 2,
      name: "Անահիտ Գրիգորյան",
      position: "Հաշվապահ",
      department: "Գրասենյակ",
      phone: "+374 91 234567",
      email: "anahit.grigoryan@example.com",
      location: "Երևան",
      avatar: "",
      status: "active",
      startDate: "2023-03-10",
      birthDate: "1990-07-15",
      address: "Երևան, Տերյան 12",
      contract: {
        totalAmount: 400000,
        paidAmount: 280000,
        monthlyPayment: 40000,
        payments: [
          { date: "2024-01-01", amount: 40000, status: "paid" },
          { date: "2024-02-01", amount: 40000, status: "paid" },
          { date: "2024-03-01", amount: 40000, status: "paid" },
          { date: "2024-04-01", amount: 40000, status: "paid" },
          { date: "2024-05-01", amount: 40000, status: "paid" },
          { date: "2024-06-01", amount: 40000, status: "paid" },
          { date: "2024-07-01", amount: 40000, status: "paid" },
          { date: "2024-08-01", amount: 40000, status: "pending" },
        ]
      }
    },
    {
      id: 3,
      name: "Գևորգ Սարգսյան",
      position: "Վարորդ",
      department: "Վարորդներ",
      phone: "+374 91 345678",
      email: "gevorg.sargsyan@example.com",
      location: "Երևան",
      avatar: "",
      status: "active",
      startDate: "2022-11-20",
      birthDate: "1988-05-10",
      address: "Երևան, Արամի 45",
      contract: {
        totalAmount: 360000,
        paidAmount: 300000,
        monthlyPayment: 30000,
        payments: [
          { date: "2024-01-01", amount: 30000, status: "paid" },
          { date: "2024-02-01", amount: 30000, status: "paid" },
          { date: "2024-03-01", amount: 30000, status: "paid" },
          { date: "2024-04-01", amount: 30000, status: "paid" },
          { date: "2024-05-01", amount: 30000, status: "paid" },
          { date: "2024-06-01", amount: 30000, status: "paid" },
          { date: "2024-07-01", amount: 30000, status: "paid" },
          { date: "2024-08-01", amount: 30000, status: "paid" },
          { date: "2024-09-01", amount: 30000, status: "paid" },
          { date: "2024-10-01", amount: 30000, status: "paid" },
          { date: "2024-11-01", amount: 30000, status: "pending" },
        ]
      }
    },
    {
      id: 4,
      name: "Դավիթ Հովհաննիսյան",
      position: "Բեռնատար",
      department: "Բեռնատարներ",
      phone: "+374 91 456789",
      email: "davit.hovhannisyan@example.com",
      location: "Գյումրի",
      avatar: "",
      status: "active",
      startDate: "2023-06-01",
      birthDate: "1992-11-25",
      address: "Գյումրի, Վարդանանց 8",
      contract: {
        totalAmount: 320000,
        paidAmount: 240000,
        monthlyPayment: 40000,
        payments: [
          { date: "2024-01-01", amount: 40000, status: "paid" },
          { date: "2024-02-01", amount: 40000, status: "paid" },
          { date: "2024-03-01", amount: 40000, status: "paid" },
          { date: "2024-04-01", amount: 40000, status: "paid" },
          { date: "2024-05-01", amount: 40000, status: "paid" },
          { date: "2024-06-01", amount: 40000, status: "paid" },
          { date: "2024-07-01", amount: 40000, status: "pending" },
        ]
      }
    },
    {
      id: 5,
      name: "Մարիամ Ավագյան",
      position: "Ինժեներ",
      department: "Ինժեներներ",
      phone: "+374 91 567890",
      email: "mariam.avagyan@example.com",
      location: "Երևան",
      avatar: "",
      status: "active",
      startDate: "2023-09-01",
      birthDate: "1987-02-14",
      address: "Երևան, Բաղրամյան 26",
      contract: {
        totalAmount: 480000,
        paidAmount: 320000,
        monthlyPayment: 60000,
        payments: [
          { date: "2024-01-01", amount: 60000, status: "paid" },
          { date: "2024-02-01", amount: 60000, status: "paid" },
          { date: "2024-03-01", amount: 60000, status: "paid" },
          { date: "2024-04-01", amount: 60000, status: "paid" },
          { date: "2024-05-01", amount: 60000, status: "paid" },
          { date: "2024-06-01", amount: 60000, status: "pending" },
        ]
      }
    }
  ]
}

const getStaffByDepartment = (department: string) => {
  if (department === "all") return staffData.all
  return staffData.all.filter(staff =>
    staff.department.toLowerCase() === department.toLowerCase()
  )
}

function StaffDrawer({ staff, open, onOpenChange }: {
  staff: typeof staffData.all[0] | null,
  open: boolean,
  onOpenChange: (open: boolean) => void
}) {
  if (!staff) return null

  const progress = (staff.contract.paidAmount / staff.contract.totalAmount) * 100
  const remainingAmount = staff.contract.totalAmount - staff.contract.paidAmount

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="h-screen top-0 right-0 left-auto mt-0 w-full sm:w-[500px] rounded-none">
        <div className="mx-auto w-full h-full overflow-y-auto">
          <DrawerHeader>
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={staff.avatar} alt={staff.name} />
                <AvatarFallback className="text-2xl">
                  {staff.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div>
                <DrawerTitle className="text-2xl">{staff.name}</DrawerTitle>
                <DrawerDescription>{staff.position}</DrawerDescription>
              </div>
            </div>
          </DrawerHeader>

          <div className="p-4 space-y-6">
            {/* Personal Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Անձնական տվյալներ</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Հեռախոս:</span>
                  <span>{staff.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Էլ. փոստ:</span>
                  <span className="truncate">{staff.email}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Հասցե:</span>
                  <span>{staff.address}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Ծննդյան օր:</span>
                  <span>{new Date(staff.birthDate).toLocaleDateString('hy-AM')}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Աշխատանքի սկիզբ:</span>
                  <span>{new Date(staff.startDate).toLocaleDateString('hy-AM')}</span>
                </div>
              </CardContent>
            </Card>

            {/* Contract Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Պայմանագրի տվյալներ</CardTitle>
                <CardDescription>
                  Ընթացիկ պայմանագրի ֆինանսական տեղեկություններ
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Ընդհանուր գումար</p>
                    <p className="text-2xl font-bold">
                      {staff.contract.totalAmount.toLocaleString()} ֏
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Վճարված</p>
                    <p className="text-2xl font-bold text-green-600">
                      {staff.contract.paidAmount.toLocaleString()} ֏
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Մնացած</p>
                    <p className="text-2xl font-bold text-orange-600">
                      {remainingAmount.toLocaleString()} ֏
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Ամսական վճար</p>
                    <p className="text-2xl font-bold">
                      {staff.contract.monthlyPayment.toLocaleString()} ֏
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Առաջընթաց</span>
                    <span className="font-medium">{progress.toFixed(1)}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              </CardContent>
            </Card>

            {/* Payment History */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Վճարումների պատմություն</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ամսաթիվ</TableHead>
                      <TableHead>Գումար</TableHead>
                      <TableHead>Կարգավիճակ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staff.contract.payments.map((payment, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          {new Date(payment.date).toLocaleDateString('hy-AM')}
                        </TableCell>
                        <TableCell>
                          {payment.amount.toLocaleString()} ֏
                        </TableCell>
                        <TableCell>
                          <Badge variant={payment.status === "paid" ? "default" : "secondary"}>
                            {payment.status === "paid" ? "Վճարված" : "Սպասվում է"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline">Փակել</Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

function StaffCard({ staff, onClick }: {
  staff: typeof staffData.all[0],
  onClick: () => void
}) {
  return (
    <Card className="w-full cursor-pointer hover:bg-accent/50 transition-colors" onClick={onClick}>
      <CardContent className="flex items-center gap-6 p-6">
        <Avatar className="h-16 w-16">
          <AvatarImage src={staff.avatar} alt={staff.name} />
          <AvatarFallback className="text-lg">
            {staff.name.split(' ').map(n => n[0]).join('')}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold hover:text-primary">{staff.name}</h3>
              <p className="text-sm text-muted-foreground">{staff.position}</p>
            </div>
            <Badge variant={staff.status === "active" ? "default" : "secondary"}>
              {staff.status === "active" ? "Ակտիվ" : "Անակտիվ"}
            </Badge>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{staff.phone}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{staff.email}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>{staff.location}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function StaffPage() {
  const [selectedStaff, setSelectedStaff] = useState<typeof staffData.all[0] | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const handleStaffClick = (staff: typeof staffData.all[0]) => {
    setSelectedStaff(staff)
    setDrawerOpen(true)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Աշխատակազմ</h2>
        <p className="text-muted-foreground">
          Կառավարեք ձեր աշխատակազմի անդամներին
        </p>
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="all">Բոլորը</TabsTrigger>
          <TabsTrigger value="office">Գրասենյակ</TabsTrigger>
          <TabsTrigger value="drivers">Վարորդներ</TabsTrigger>
          <TabsTrigger value="loaders">Բեռնատարներ</TabsTrigger>
          <TabsTrigger value="engineers">Ինժեներներ</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {getStaffByDepartment("all").map((staff) => (
            <StaffCard key={staff.id} staff={staff} onClick={() => handleStaffClick(staff)} />
          ))}
        </TabsContent>

        <TabsContent value="office" className="space-y-4">
          {getStaffByDepartment("Գրասենյակ").map((staff) => (
            <StaffCard key={staff.id} staff={staff} onClick={() => handleStaffClick(staff)} />
          ))}
        </TabsContent>

        <TabsContent value="drivers" className="space-y-4">
          {getStaffByDepartment("Վարորդներ").map((staff) => (
            <StaffCard key={staff.id} staff={staff} onClick={() => handleStaffClick(staff)} />
          ))}
        </TabsContent>

        <TabsContent value="loaders" className="space-y-4">
          {getStaffByDepartment("Բեռնատարներ").map((staff) => (
            <StaffCard key={staff.id} staff={staff} onClick={() => handleStaffClick(staff)} />
          ))}
        </TabsContent>

        <TabsContent value="engineers" className="space-y-4">
          {getStaffByDepartment("Ինժեներներ").map((staff) => (
            <StaffCard key={staff.id} staff={staff} onClick={() => handleStaffClick(staff)} />
          ))}
        </TabsContent>
      </Tabs>

      <StaffDrawer
        staff={selectedStaff}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  )
}
