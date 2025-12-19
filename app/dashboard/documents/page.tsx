"use client"

import { useState, useMemo, useCallback } from "react"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  FileText,
  FileImage,
  FileSpreadsheet,
  File,
  Download,
  Eye,
  MoreVertical,
  Calendar,
  User,
  Plus,
  Upload,
  Monitor,
  Scan,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScannerComponent } from "@/components/scanner-component"

// Document types with icons
const getFileIcon = (fileType: string) => {
  switch (fileType) {
    case "pdf":
      return <FileText className="h-12 w-12 text-red-500" />
    case "jpg":
    case "png":
    case "jpeg":
      return <FileImage className="h-12 w-12 text-blue-500" />
    case "xlsx":
    case "xls":
      return <FileSpreadsheet className="h-12 w-12 text-green-500" />
    case "docx":
    case "doc":
      return <FileText className="h-12 w-12 text-blue-600" />
    default:
      return <File className="h-12 w-12 text-gray-500" />
  }
}

// Sample documents data
const documentsData = [
  {
    id: 1,
    name: "Պայմանագիր_2024.pdf",
    fileType: "pdf",
    size: "2.5 MB",
    uploadDate: "2024-01-15",
    uploadedBy: "Արամ Պետրոսյան",
    project: "Նախագիծ 1",
    category: "Պայմանագրեր",
  },
  {
    id: 2,
    name: "Հաշվետվություն_Q1.xlsx",
    fileType: "xlsx",
    size: "1.2 MB",
    uploadDate: "2024-02-20",
    uploadedBy: "Անահիտ Գրիգորյան",
    project: "Նախագիծ 2",
    category: "Հաշվետվություններ",
  },
  {
    id: 3,
    name: "Նկար_1.jpg",
    fileType: "jpg",
    size: "3.8 MB",
    uploadDate: "2024-03-10",
    uploadedBy: "Գևորգ Սարգսյան",
    project: "Նախագիծ 1",
    category: "Նկարներ",
  },
  {
    id: 4,
    name: "Ֆինանսական_հաշվետվություն.docx",
    fileType: "docx",
    size: "856 KB",
    uploadDate: "2024-04-05",
    uploadedBy: "Անահիտ Գրիգորյան",
    project: "Նախագիծ 3",
    category: "Հաշվետվություններ",
  },
  {
    id: 5,
    name: "Աշխատանքային_գրաֆիկ.xlsx",
    fileType: "xlsx",
    size: "425 KB",
    uploadDate: "2024-05-12",
    uploadedBy: "Արամ Պետրոսյան",
    project: "Նախագիծ 2",
    category: "Գրաֆիկներ",
  },
  {
    id: 6,
    name: "Հարկային_փաստաթուղթ.pdf",
    fileType: "pdf",
    size: "1.8 MB",
    uploadDate: "2024-06-18",
    uploadedBy: "Անահիտ Գրիգորյան",
    project: "Նախագիծ 1",
    category: "Հարկային",
  },
  {
    id: 7,
    name: "Ծրագիր_2024.png",
    fileType: "png",
    size: "2.1 MB",
    uploadDate: "2024-07-22",
    uploadedBy: "Մարիամ Ավագյան",
    project: "Նախագիծ 3",
    category: "Նկարներ",
  },
  {
    id: 8,
    name: "Վերլուծություն.docx",
    fileType: "docx",
    size: "1.5 MB",
    uploadDate: "2024-08-14",
    uploadedBy: "Դավիթ Հովհաննիսյան",
    project: "Նախագիծ 2",
    category: "Վերլուծություններ",
  },
]

// Get unique values for filters
const getUniqueProjects = () => {
  const projects = documentsData.map(doc => doc.project)
  return [...new Set(projects)]
}

const getUniqueCategories = () => {
  const categories = documentsData.map(doc => doc.category)
  return [...new Set(categories)]
}

const getUniqueFileTypes = () => {
  const types = documentsData.map(doc => doc.fileType)
  return [...new Set(types)]
}

export default function DocumentsPage() {
  const [selectedFileType, setSelectedFileType] = useState<string>("all")
  const [selectedProject, setSelectedProject] = useState<string>("all")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("newest")
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    setSelectedFiles(prev => [...prev, ...files])
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files)
      setSelectedFiles(prev => [...prev, ...files])
    }
  }, [])

  const removeFile = useCallback((index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }, [])

  const handleScannedFiles = useCallback((files: File[]) => {
    setSelectedFiles(prev => [...prev, ...files])
  }, [])

  // Filter and sort documents
  const filteredAndSortedDocuments = useMemo(() => {
    let filtered = documentsData.filter(doc => {
      const fileTypeMatch = selectedFileType === "all" || doc.fileType === selectedFileType
      const projectMatch = selectedProject === "all" || doc.project === selectedProject
      const categoryMatch = selectedCategory === "all" || doc.category === selectedCategory
      return fileTypeMatch && projectMatch && categoryMatch
    })

    // Sort documents
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()
        case "oldest":
          return new Date(a.uploadDate).getTime() - new Date(b.uploadDate).getTime()
        case "name":
          return a.name.localeCompare(b.name)
        default:
          return 0
      }
    })

    return filtered
  }, [selectedFileType, selectedProject, selectedCategory, sortBy])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Փաստաթղթեր</h2>
          <p className="text-muted-foreground">
            Կառավարեք ձեր բոլոր փաստաթղթերը մեկ տեղում
          </p>
        </div>
        <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Ավելացնել ֆայլ
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Ավելացնել նոր փաստաթուղթ</DialogTitle>
              <DialogDescription>
                Ընտրեք ֆայլերը քաշելով և թողնելով, ընտրելով համակարգչից կամ սկանավորելով
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="upload" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upload">Վերբեռնել</TabsTrigger>
                <TabsTrigger value="scan">Սկանավորել</TabsTrigger>
              </TabsList>

              <TabsContent value="upload" className="space-y-4 py-4">
                {/* Drag and Drop Area */}
                <div
                  onDragEnter={handleDragEnter}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    isDragging
                      ? "border-primary bg-primary/5"
                      : "border-muted-foreground/25 hover:border-muted-foreground/50"
                  }`}
                >
                  <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm font-medium mb-1">
                    Քաշեք և թողեք ֆայլերը այստեղ
                  </p>
                  <p className="text-xs text-muted-foreground">
                    կամ սեղմեք ներքևի կոճակը՝ ֆայլ ընտրելու համար
                  </p>
                </div>

                {/* Upload from PC */}
                <div className="relative">
                  <input
                    type="file"
                    id="file-upload"
                    multiple
                    onChange={handleFileSelect}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-20 flex flex-col gap-2"
                  >
                    <Monitor className="h-8 w-8" />
                    <span>Ընտրել համակարգչից</span>
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="scan" className="space-y-4 py-4">
                <ScannerComponent onScanned={handleScannedFiles} />
              </TabsContent>
            </Tabs>

            <div className="space-y-4">{/* This wrapper keeps the selected files and upload button outside tabs */}

                {/* Selected Files List */}
                {selectedFiles.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Ընտրված ֆայլեր ({selectedFiles.length})</p>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {selectedFiles.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-2 bg-muted rounded-lg"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <File className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm truncate">{file.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {(file.size / 1024).toFixed(2)} KB
                              </p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeFile(index)}
                            className="flex-shrink-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Upload Button */}
                {selectedFiles.length > 0 && (
                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setSelectedFiles([])
                        setIsUploadDialogOpen(false)
                      }}
                    >
                      Չեղարկել
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        // Handle upload logic here
                        console.log("Uploading files:", selectedFiles)
                        setSelectedFiles([])
                        setIsUploadDialogOpen(false)
                      }}
                    >
                      Վերբեռնել ({selectedFiles.length})
                    </Button>
                  </div>
                )}
              </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="w-full sm:w-48">
          <Select value={selectedFileType} onValueChange={setSelectedFileType}>
            <SelectTrigger>
              <SelectValue placeholder="Ֆայլի տեսակ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Բոլոր ֆայլերը</SelectItem>
              {getUniqueFileTypes().map(type => (
                <SelectItem key={type} value={type}>
                  {type.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-full sm:w-48">
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger>
              <SelectValue placeholder="Նախագիծ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Բոլոր նախագծերը</SelectItem>
              {getUniqueProjects().map(project => (
                <SelectItem key={project} value={project}>
                  {project}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-full sm:w-48">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Կատեգորիա" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Բոլոր կատեգորիաները</SelectItem>
              {getUniqueCategories().map(category => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-full sm:w-48 ml-auto">
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger>
              <SelectValue placeholder="Դասավորել" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Նորագույն</SelectItem>
              <SelectItem value="oldest">Հնագույն</SelectItem>
              <SelectItem value="name">Անվան պատվով</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Ցուցադրվում է {filteredAndSortedDocuments.length} փաստաթուղթ
      </div>

      {/* Documents Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredAndSortedDocuments.map((doc) => (
          <Card key={doc.id} className="group hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex flex-col items-center space-y-4">
                {/* File Icon */}
                <div className="p-4 bg-muted rounded-lg">
                  {getFileIcon(doc.fileType)}
                </div>

                {/* File Info */}
                <div className="w-full space-y-2">
                  <h3 className="font-semibold truncate text-center" title={doc.name}>
                    {doc.name}
                  </h3>

                  <div className="flex flex-wrap gap-1 justify-center">
                    <Badge variant="secondary" className="text-xs">
                      {doc.fileType.toUpperCase()}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {doc.size}
                    </Badge>
                  </div>

                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center justify-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>{new Date(doc.uploadDate).toLocaleDateString('hy-AM')}</span>
                    </div>
                    <div className="flex items-center justify-center gap-1">
                      <User className="h-3 w-3" />
                      <span className="truncate">{doc.uploadedBy}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-1">
                    <Badge variant="outline" className="text-xs">
                      {doc.project}
                    </Badge>
                  </div>

                  <div className="text-center">
                    <Badge className="text-xs">
                      {doc.category}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>

            <CardFooter className="p-3 pt-0 flex justify-center gap-2">
              <Button size="sm" variant="outline" className="flex-1">
                <Eye className="h-4 w-4 mr-1" />
                Դիտել
              </Button>
              <Button size="sm" variant="outline" className="flex-1">
                <Download className="h-4 w-4 mr-1" />
                Ներբեռնել
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>Խմբագրել</DropdownMenuItem>
                  <DropdownMenuItem>Կիսվել</DropdownMenuItem>
                  <DropdownMenuItem className="text-red-600">Ջնջել</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredAndSortedDocuments.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12">
          <File className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">Փաստաթղթեր չեն գտնվել</h3>
          <p className="text-sm text-muted-foreground">
            Փորձեք փոխել ֆիլտրերը կամ որոնման պայմանները
          </p>
        </div>
      )}
    </div>
  )
}
