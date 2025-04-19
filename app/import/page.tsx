"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"
import Link from "next/link"

export default function ImportPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    success: boolean
    message: string
    details?: string
    count?: number
  } | null>(null)

  async function importData() {
    setLoading(true)
    setResult(null)

    try {
      // Fetch the CSV data
      const response = await fetch(
        "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/MASTER%20GCR%20-%20Sheet1%20%281%29-6MVjaazXW1nPW5wWw6qgESVm3vXJWI.csv",
      )

      if (!response.ok) {
        throw new Error(`Failed to fetch CSV: ${response.status} ${response.statusText}`)
      }

      const csvText = await response.text()

      // Parse CSV
      const rows = csvText.split("\n")
      const headers = rows[0].split(",").map((header) => header.trim())

      const parsedData = rows.slice(1).map((row) => {
        const values = row.split(",").map((value) => value.trim())
        const course: Record<string, string> = {}

        headers.forEach((header, index) => {
          // Handle the special case for redesigns and restorations which have parentheses in the header
          if (header.includes("redesign")) {
            course["redesigns"] = values[index] || ""
          } else if (header.includes("restoration")) {
            course["restorations"] = values[index] || ""
          } else {
            course[header.toLowerCase().replace(/\s+/g, "_")] = values[index] || ""
          }
        })

        return course
      })

      // Filter out empty rows
      const filteredData = parsedData.filter((course) => course.club_name)

      console.log(`Parsed ${filteredData.length} rows from CSV`)

      // Check if table already has data
      const { count } = await supabase.from("golf_courses").select("*", { count: "exact", head: true })

      if (count && count > 0) {
        // Clear existing data if there's any
        await supabase.from("golf_courses").delete().neq("id", "00000000-0000-0000-0000-000000000000")
        console.log("Cleared existing data")
      }

      // Insert data in batches to avoid request size limits
      const batchSize = 50
      let insertedCount = 0

      for (let i = 0; i < filteredData.length; i += batchSize) {
        const batch = filteredData.slice(i, i + batchSize)

        const { error } = await supabase.from("golf_courses").insert(batch)

        if (error) {
          throw new Error(`Error inserting batch ${i / batchSize + 1}: ${error.message}`)
        }

        insertedCount += batch.length
        console.log(`Inserted batch ${i / batchSize + 1} (${insertedCount}/${filteredData.length} rows)`)
      }

      setResult({
        success: true,
        message: "Data imported successfully!",
        count: insertedCount,
      })
    } catch (error) {
      console.error("Import error:", error)
      setResult({
        success: false,
        message: "Failed to import data",
        details: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Import CSV Data to Supabase</h1>
      <p className="text-muted-foreground mb-6">
        This utility will import the golf course data from the CSV file into your Supabase table.
      </p>

      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>CSV Data Import</CardTitle>
          <CardDescription>Import data from the CSV file into your 'golf_courses' Supabase table</CardDescription>
        </CardHeader>
        <CardContent>
          {result && (
            <Alert variant={result.success ? "success" : "destructive"} className="mb-4">
              {result.success ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
              <AlertTitle>{result.success ? "Success" : "Error"}</AlertTitle>
              <AlertDescription>
                {result.message}
                {result.count && <p className="mt-1">Imported {result.count} rows.</p>}
                {result.details && (
                  <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">{result.details}</pre>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <p>This will:</p>
            <ol className="list-decimal pl-5 space-y-2">
              <li>Fetch the CSV file from the provided URL</li>
              <li>Parse the CSV data</li>
              <li>Clear any existing data in the 'golf_courses' table</li>
              <li>Insert the parsed data into the 'golf_courses' table</li>
            </ol>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button onClick={importData} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? "Importing..." : "Import Data"}
          </Button>
          {result?.success && (
            <Link href="/">
              <Button variant="outline">Go to Golf Courses Table</Button>
            </Link>
          )}
        </CardFooter>
      </Card>
    </main>
  )
}
