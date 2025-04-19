"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import {
  type ColumnFiltersState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  createColumnHelper,
} from "@tanstack/react-table"
import { Input } from "@/components/ui/input"
import { Loader2, Search, ArrowUp, ArrowDown } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"

// Define the column meta type
type ColumnMeta = {
  className?: string
}

// Extend the @tanstack/react-table types
declare module '@tanstack/react-table' {
  interface ColumnMeta<TData extends unknown, TValue> {
    className?: string
  }
}

type GolfCourse = {
  id?: string
  course_name: string
  club_name: string
  designer: string
  year_built: string
  access: string
  golf_digest_country_rating: string
  city: string
  state_or_region: string
  country: string
  golf_mag_country_rating: string
  redesigns: string
  restorations: string
  description: string
  consensus_ranking?: number
}

export function GolfCoursesTable() {
  // Set default sorting to consensus ranking
  const [sorting, setSorting] = useState<SortingState>([
    {
      id: "consensus_ranking",
      desc: false,
    },
  ])

  const [data, setData] = useState<GolfCourse[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(0)
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})
  const [globalFilter, setGlobalFilter] = useState("")
  const [sortString, setSortString] = useState<string>("")
  const [isClientSideSorting, setIsClientSideSorting] = useState(true) // Start with client-side sorting for consensus
  const [allData, setAllData] = useState<GolfCourse[]>([])

  const PAGE_SIZE = 20
  const observerTarget = useRef<HTMLDivElement>(null)
  const initialLoadComplete = useRef(false)

  // Custom sorting handler to toggle between ascending and descending only
  const handleSortingChange = useCallback((updaterOrValue: SortingState | ((old: SortingState) => SortingState)) => {
    setSorting((old) => {
      // If the updater is a function, call it with the old value
      const newSorting = typeof updaterOrValue === "function" ? updaterOrValue(old) : updaterOrValue

      // If the new sorting is empty, default to ascending sort on the first column
      if (newSorting.length === 0 && old.length > 0) {
        return [{ ...old[0], desc: false }]
      }

      return newSorting
    })
  }, [])

  // Create a stable sort string to use as a dependency
  useEffect(() => {
    if (sorting.length > 0) {
      const { id, desc } = sorting[0]
      setSortString(`${id}-${desc ? "desc" : "asc"}`)

      // Check if we need client-side sorting
      setIsClientSideSorting(id === "consensus_ranking")
    } else {
      setSortString("")
      setIsClientSideSorting(false)
    }
  }, [sorting])

  // Calculate consensus ranking
  const calculateConsensusRanking = useCallback((course: GolfCourse): number => {
    const digestRanking = Number.parseInt(course.golf_digest_country_rating) || 0
    const magRanking = Number.parseInt(course.golf_mag_country_rating) || 0

    // If both rankings exist, average them with one decimal place
    if (digestRanking && magRanking) {
      return Math.round(((digestRanking + magRanking) / 2) * 10) / 10
    }

    // If only one ranking exists, use that
    return digestRanking || magRanking || 0
  }, [])

  // Client-side sorting function for consensus ranking
  const sortDataByConsensusRanking = useCallback((data: GolfCourse[], desc: boolean) => {
    return [...data].sort((a, b) => {
      const rankingA = a.consensus_ranking || 0
      const rankingB = b.consensus_ranking || 0

      if (rankingA === rankingB) return 0

      // For ascending order (smaller numbers first)
      const comparison = rankingA - rankingB

      // Reverse for descending order
      return desc ? -comparison : comparison
    })
  }, [])

  const fetchData = useCallback(
    async (pageIndex: number, isInitialLoad = false, fetchAll = false) => {
      try {
        if (isInitialLoad) {
          setLoading(true)
        } else if (!fetchAll) {
          setLoadingMore(true)
        }

        // If we need client-side sorting for consensus_ranking, fetch all data
        if (isClientSideSorting && isInitialLoad) {
          // Fetch all data for client-side sorting
          const { data: allData, error } = await supabase.from("golf_courses").select("*")

          if (error) {
            console.error("Error fetching all data:", error)
            throw error
          }

          // Calculate consensus ranking for all courses
          const dataWithConsensus = (allData || []).map((course) => ({
            ...course,
            consensus_ranking: calculateConsensusRanking(course),
          }))

          setAllData(dataWithConsensus)

          // Sort the data client-side
          const sortedData = sortDataByConsensusRanking(dataWithConsensus, sorting.length > 0 ? sorting[0].desc : false)

          // Take only the first page
          setData(sortedData.slice(0, PAGE_SIZE))
          setHasMore(sortedData.length > PAGE_SIZE)
          setPage(0)
          return
        } else if (isClientSideSorting && !isInitialLoad) {
          // Load next page from already fetched data
          const sortedData = sortDataByConsensusRanking(allData, sorting.length > 0 ? sorting[0].desc : false)

          const nextPageData = sortedData.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE)
          setData((prevData) => [...prevData, ...nextPageData])
          setHasMore(sortedData.length > (pageIndex + 1) * PAGE_SIZE)
          setPage(pageIndex)
          return
        }

        // For server-side sorting (normal case)
        // Build the query with pagination
        let query = supabase.from("golf_courses").select("*")

        if (!fetchAll) {
          query = query.range(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE - 1)
        }

        // Add sorting if available
        if (sorting.length > 0) {
          const { id, desc } = sorting[0]

          // Skip sorting for consensus_ranking as it doesn't exist in the database
          if (id !== "consensus_ranking") {
            // Special handling for numeric columns
            if (id === "golf_digest_country_rating" || id === "golf_mag_country_rating") {
              // For numeric sorting, handle empty values by putting them at the end
              query = query.order(id, { ascending: !desc, nullsFirst: false })
            } else {
              query = query.order(id, { ascending: !desc })
            }
          } else {
            // Default sort by id if trying to sort by consensus_ranking
            query = query.order("id", { ascending: true })
          }
        } else {
          // Default sorting by golf_digest_country_rating
          query = query.order("golf_digest_country_rating", { ascending: true, nullsFirst: false })
        }

        const { data: newData, error } = await query

        if (error) {
          console.error("Error fetching data:", error)
          throw error
        }

        // Calculate consensus ranking for each course
        const dataWithConsensus = (newData || []).map((course) => ({
          ...course,
          consensus_ranking: calculateConsensusRanking(course),
        }))

        if (isInitialLoad) {
          setData(dataWithConsensus || [])
        } else {
          setData((prevData) => [...prevData, ...(dataWithConsensus || [])])
        }

        // Check if we have more data to load
        setHasMore((newData || []).length === PAGE_SIZE)
        setPage(pageIndex)
      } catch (error) {
        console.error("Failed to fetch data:", error)
      } finally {
        if (isInitialLoad) {
          setLoading(false)
          initialLoadComplete.current = true
        } else if (!fetchAll) {
          setLoadingMore(false)
        }
      }
    },
    [sorting, calculateConsensusRanking, isClientSideSorting, allData, sortDataByConsensusRanking],
  )

  // Initial data load
  useEffect(() => {
    fetchData(0, true)
  }, []) // Empty dependency array for initial load only

  // Handle sorting changes
  useEffect(() => {
    // Only reset and refetch if initial load is complete
    // This prevents the flashing issue during first render
    if (initialLoadComplete.current) {
      setData([])
      setPage(0)
      fetchData(0, true)
    }
  }, [sortString]) // Use sortString as dependency instead of fetchData

  // Set up intersection observer for infinite scrolling
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          fetchData(page + 1)
        }
      },
      { threshold: 0.1 }, // Lower threshold to trigger earlier
    )

    const currentTarget = observerTarget.current
    if (currentTarget) {
      observer.observe(currentTarget)
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget)
      }
    }
  }, [hasMore, loadingMore, loading, page, fetchData])

  // Toggle row expansion
  const toggleRowExpansion = useCallback((rowId: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [rowId]: !prev[rowId],
    }))
  }, [])

  const columnHelper = createColumnHelper<GolfCourse>()

  // Flattened columns without grouping
  const columns = [
    columnHelper.accessor("club_name", {
      header: "Course",
      cell: ({ row }) => {
        const club = row.original.club_name
        const course = row.original.course_name
        return (
          <div className="font-bold">
            {club} {course && <span className="text-muted-foreground">({course})</span>}
          </div>
        )
      },
    }),
    // City, State column with no header
    columnHelper.accessor("city", {
      meta: {
        className: "hidden md:table-cell",
      },
      header: "",
      cell: ({ row }) => {
        const city = row.original.city
        const state = row.original.state_or_region

        if (!city && !state) return null

        return (
          <div className="text-sm text-gray-500 hidden md:table-cell">
            {city}
            {city && state && ", "}
            {state}
          </div>
        )
      },
    }),
    columnHelper.accessor("golf_digest_country_rating", {
      header: ({ column }) => {
        return (
          <div
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="flex items-center justify-end cursor-pointer select-none"
          >
            Golf Digest
            <span className="ml-2 h-4 w-4 inline-flex shrink-0 items-center justify-center text-muted-foreground">
              {column.getIsSorted() === "asc" ? (
                <ArrowUp className="h-4 w-4" />
              ) : column.getIsSorted() === "desc" ? (
                <ArrowDown className="h-4 w-4" />
              ) : (
                <div className="h-4 w-4" />
              )}
            </span>
          </div>
        )
      },
      cell: ({ row }) => {
        const rating = row.original.golf_digest_country_rating
        return (
          <div className="text-center">
            {rating ? `${rating}` : "N/A"}
          </div>
        )
      },
      meta: {
        className: "text-center",
      },
    }),
    columnHelper.accessor("golf_mag_country_rating", {
      header: ({ column }) => {
        return (
          <div
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="flex items-center justify-end cursor-pointer select-none"
          >
            Golf Mag
            <span className="ml-2 h-4 w-4 inline-flex shrink-0 items-center justify-center text-muted-foreground">
              {column.getIsSorted() === "asc" ? (
                <ArrowUp className="h-4 w-4" />
              ) : column.getIsSorted() === "desc" ? (
                <ArrowDown className="h-4 w-4" />
              ) : (
                <div className="h-4 w-4" />
              )}
            </span>
          </div>
        )
      },
      cell: ({ row }) => {
        const rating = row.original.golf_mag_country_rating
        return (
          <div className="text-center">
            {rating ? `${rating}` : "N/A"}
          </div>
        )
      },
      meta: {
        className: "text-center",
      },
    }),
    columnHelper.accessor("consensus_ranking", {
      header: ({ column }) => {
        return (
          <div
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="flex items-center justify-end cursor-pointer select-none"
          >
            Consensus
            <span className="ml-2 h-4 w-4 inline-flex shrink-0 items-center justify-center text-muted-foreground">
              {column.getIsSorted() === "asc" ? (
                <ArrowUp className="h-4 w-4" />
              ) : column.getIsSorted() === "desc" ? (
                <ArrowDown className="h-4 w-4" />
              ) : (
                <div className="h-4 w-4" />
              )}
            </span>
          </div>
        )
      },
      cell: ({ row }) => {
        const rating = row.original.consensus_ranking
        // Format with one decimal place
        return (
          <div className="text-center">
            {rating ? rating.toFixed(1) : "N/A"}
          </div>
        )
      },
      meta: {
        className: "text-center",
      },
    }),
  ]

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    manualSorting: true,
    onSortingChange: handleSortingChange, // Use custom sorting handler
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    // Custom sort toggle to only toggle between asc and desc
    sortDescFirst: false, // Start with ascending sort
  })

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center space-x-4 mb-4">
          <Skeleton className="h-10 w-full" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search all columns..."
          value={globalFilter ?? ""}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="pl-9 max-w-sm"
        />
      </div>

      <div className="rounded-md border">
        <div className="table-wrapper">
          <table className="w-full">
            <thead>
              <tr className="sticky-header">
                {table.getHeaderGroups()[0].headers.map((header) => {
                  // Skip rendering header cell if header is null
                  if (header.column.columnDef.header === null) {
                    return <th key={header.id} className="px-4 py-3 hidden md:table-cell"></th>
                  }

                  // Determine if this is a rankings column
                  const isRankingsColumn =
                    header.id.includes("golf_digest") ||
                    header.id.includes("golf_mag") ||
                    header.id.includes("consensus")

                  // Check if this column is sortable
                  const isSortable = header.column.getCanSort()

                  // Get the current sort direction for this column
                  const sortDirection = header.column.getIsSorted()

                  return (
                    <th
                      key={header.id}
                      colSpan={header.colSpan}
                      className={`px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 ${
                        header.column.columnDef.meta?.className || ""
                      }`}
                      onClick={
                        header.column.getCanSort()
                          ? header.column.getToggleSortingHandler()
                          : undefined
                      }
                    >
                      <div className={`header-container ${isRankingsColumn ? "justify-center" : ""}`}>
                        <span className="header-text">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </span>
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <React.Fragment key={row.id}>
                    <tr
                      className="cursor-pointer hover:bg-muted/50 border-b"
                      onClick={() => toggleRowExpansion(row.id)}
                    >
                      {row.getVisibleCells().map((cell) => {
                        // Get the column meta data for styling
                        // Check if this is the city column (should be hidden on mobile)
                        const isCityColumn = cell.column.id === "city"

                        return (
                          <td
                            key={cell.id}
                            // Restore original classes, excluding the problematic meta.className access
                            className={`px-4 py-3 border-b border-gray-200 dark:border-gray-700 text-sm ${
                              cell.column.columnDef.meta?.className || ""
                            }`}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        )
                      })}
                    </tr>
                    {expandedRows[row.id] && (
                      <tr className="bg-muted/50 border-b">
                        <td colSpan={columns.length} className="p-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <h3 className="font-medium mb-2">Course Details</h3>
                              <div className="space-y-1">
                                <p>
                                  <span className="font-medium">Designer:</span> {row.original.designer || "N/A"}
                                </p>
                                <p>
                                  <span className="font-medium">Year Built:</span> {row.original.year_built || "N/A"}
                                </p>
                                <p>
                                  <span className="font-medium">Access:</span> {row.original.access || "N/A"}
                                </p>
                              </div>
                            </div>
                            <div>
                              <h3 className="font-medium mb-2">Location</h3>
                              <div className="space-y-1">
                                <p>
                                  <span className="font-medium">City:</span> {row.original.city || "N/A"}
                                </p>
                                <p>
                                  <span className="font-medium">State/Region:</span>{" "}
                                  {row.original.state_or_region || "N/A"}
                                </p>
                                <p>
                                  <span className="font-medium">Country:</span> {row.original.country || "N/A"}
                                </p>
                              </div>
                            </div>
                            {(row.original.redesigns || row.original.restorations) && (
                              <div className="col-span-1 md:col-span-2">
                                <h3 className="font-medium mb-2">Modifications</h3>
                                <div className="space-y-2">
                                  {row.original.redesigns && (
                                    <div>
                                      <span className="font-medium">Redesigns:</span>
                                      <Badge variant="outline" className="ml-2">
                                        {row.original.redesigns}
                                      </Badge>
                                    </div>
                                  )}
                                  {row.original.restorations && (
                                    <div>
                                      <span className="font-medium">Restorations:</span>
                                      <Badge variant="outline" className="ml-2">
                                        {row.original.restorations}
                                      </Badge>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            {row.original.description && (
                              <div className="col-span-1 md:col-span-2">
                                <h3 className="font-medium mb-2">Description</h3>
                                <p className="text-sm text-muted-foreground">{row.original.description}</p>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length} className="h-24 text-center">
                    No results found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Infinite scroll loading indicator and observer target */}
      <div ref={observerTarget} className="py-4 flex justify-center">
        {loadingMore && (
          <div className="flex items-center space-x-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading more...</span>
          </div>
        )}
        {!hasMore && data.length > 0 && <div className="text-sm text-muted-foreground">All courses loaded</div>}
      </div>
    </div>
  )
}
