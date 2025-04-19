"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Loader2 } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export default function CheckDataPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tableInfo, setTableInfo] = useState<{
    exists: boolean
    rowCount: number
    sampleData: any[] | null
    schema: { column: string; dataType: string }[] | null
  }>({
    exists: false,
    rowCount: 0,
    sampleData: null,
    schema: null,
  })

  useEffect(() => {
    checkTableData()
  }, [])

  async function checkTableData() {
    setLoading(true)
    setError(null)

    try {
      console.log("Checking table data...")

      // First, check if the table exists by trying to get its schema
      const { data: schemaData, error: schemaError } = await supabase
        .rpc("get_table_schema", {
          table_name: "golf_courses",
        })
        .select("*")

      if (schemaError) {
        // Try an alternative approach if the RPC function doesn't exist
        console.log("RPC method not available, trying direct query...")

        // Check if table exists by querying it
        const { error: tableError } = await supabase.from("golf_courses").select("*", { count: "exact", head: true })

        if (tableError && tableError.code === "42P01") {
          setTableInfo({
            exists: false,
            rowCount: 0,
            sampleData: null,
            schema: null,
          })
          return
        }
      }

      // Table exists, get row count with no filters
      const { count, error: countError } = await supabase
        .from("golf_courses")
        .select("*", { count: "exact", head: true })

      if (countError) {
        throw new Error(`Error getting row count: ${countError.message}`)
      }

      // Get sample data (first 5 rows)
      const { data: sampleData, error: sampleError } = await supabase.from("golf_courses").select("*").limit(5)

      if (sampleError) {
        throw new Error(`Error getting sample data: ${sampleError.message}`)
      }

      // Get column information
      let schema = null
      if (schemaData) {
        schema = schemaData
      } else {
        // If we don't have schema data, infer it from the sample data
        if (sampleData && sampleData.length > 0) {
          schema = Object.keys(sampleData[0]).map((column) => ({
            column,
            dataType: typeof sampleData[0][column],
          }))
        }
      }

      setTableInfo({
        exists: true,
        rowCount: count || 0,
        sampleData,
        schema,
      })
    } catch (err) {
      console.error("Error checking table data:", err)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Check Supabase Table Data</h1>
      <p className="text-muted-foreground mb-6">This page checks the data in your 'golf_courses' Supabase table.</p>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Checking table data...</span>
        </div>
      ) : error ? (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Table Status</CardTitle>
              <CardDescription>Information about the 'golf_courses' table</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-medium">Table Exists</h3>
                    <p className="text-muted-foreground">
                      {tableInfo.exists ? (
                        <span className="text-green-600 font-medium">Yes</span>
                      ) : (
                        <span className="text-red-600 font-medium">No</span>
                      )}
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium">Row Count</h3>
                    <p className="text-muted-foreground">{tableInfo.rowCount}</p>
                  </div>
                </div>

                {tableInfo.schema && tableInfo.schema.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-2">Table Schema</h3>
                    <div className="border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Column</TableHead>
                            <TableHead>Data Type</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {tableInfo.schema.map((col, index) => (
                            <TableRow key={index}>
                              <TableCell>{col.column}</TableCell>
                              <TableCell>{col.dataType}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {tableInfo.sampleData && tableInfo.sampleData.length > 0 ? (
                  <div>
                    <h3 className="font-medium mb-2">Sample Data (First 5 Rows)</h3>
                    <div className="border rounded-md overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {Object.keys(tableInfo.sampleData[0]).map((key) => (
                              <TableHead key={key}>{key}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {tableInfo.sampleData.map((row, rowIndex) => (
                            <TableRow key={rowIndex}>
                              {Object.values(row).map((value: any, colIndex) => (
                                <TableCell key={colIndex}>
                                  {value === null
                                    ? "null"
                                    : typeof value === "object"
                                      ? JSON.stringify(value)
                                      : String(value)}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : tableInfo.exists ? (
                  <Alert>
                    <AlertCircle className="h-5 w-5" />
                    <AlertTitle>No Data</AlertTitle>
                    <AlertDescription>
                      The table exists but contains no data. You may need to import data from the CSV file.
                    </AlertDescription>
                  </Alert>
                ) : null}
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={checkTableData} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? "Checking..." : "Refresh Data"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </main>
  )
}
