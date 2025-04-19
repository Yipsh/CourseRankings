"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, CheckCircle2, XCircle, Loader2 } from "lucide-react"

export function SupabaseDebug() {
  const [debugInfo, setDebugInfo] = useState<{
    envVars: { [key: string]: boolean }
    clientInitialized: boolean
    connectionTest: { success: boolean; message: string; error?: any }
    tableTest: { success: boolean; message: string; error?: any; tables?: string[] }
    queryTest: { success: boolean; message: string; error?: any; data?: any }
  }>({
    envVars: {
      NEXT_PUBLIC_SUPABASE_URL: false,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: false,
    },
    clientInitialized: false,
    connectionTest: { success: false, message: "Not tested yet" },
    tableTest: { success: false, message: "Not tested yet" },
    queryTest: { success: false, message: "Not tested yet" },
  })

  const [loading, setLoading] = useState(false)

  async function runDiagnostics() {
    setLoading(true)

    // Check environment variables
    const envVars = {
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    }

    // Check if client is initialized
    const clientInitialized = !!supabase

    // Test connection
    let connectionTest = { success: false, message: "Failed to test connection" }
    try {
      console.log("Testing Supabase connection...")
      // Simple query to test connection
      const { data, error } = await supabase.from("golf_courses").select("*", { count: "exact", head: true })

      if (error) {
        throw error
      }

      connectionTest = {
        success: true,
        message: "Successfully connected to Supabase",
      }
    } catch (error) {
      console.error("Connection test error:", error)
      connectionTest = {
        success: false,
        message: "Failed to connect to Supabase",
        error,
      }
    }

    // Test table existence
    let tableTest = { success: false, message: "Failed to test tables" }
    try {
      console.log("Testing table existence...")

      // Check if golf_courses table exists by trying to query it
      const { error } = await supabase.from("golf_courses").select("*", { count: "exact", head: true })

      if (error) {
        if (error.code === "42P01") {
          // Table doesn't exist
          tableTest = {
            success: false,
            message: "The 'golf_courses' table does not exist",
            error,
          }
        } else {
          throw error
        }
      } else {
        tableTest = {
          success: true,
          message: "Found 'golf_courses' table",
        }
      }
    } catch (error) {
      console.error("Table test error:", error)
      tableTest = {
        success: false,
        message: "Failed to check tables",
        error,
      }
    }

    // Test query
    let queryTest = { success: false, message: "Failed to test query" }
    try {
      console.log("Testing query on golf_courses table...")
      const { data, error, count } = await supabase.from("golf_courses").select("*", { count: "exact" }).limit(1)

      if (error) {
        throw error
      }

      queryTest = {
        success: true,
        message: `Successfully queried 'golf_courses' table. Found ${count || 0} total rows.`,
        data,
      }
    } catch (error) {
      console.error("Query test error:", error)
      queryTest = {
        success: false,
        message: "Failed to query 'golf_courses' table",
        error,
      }
    }

    setDebugInfo({
      envVars,
      clientInitialized,
      connectionTest,
      tableTest,
      queryTest,
    })

    setLoading(false)
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Supabase Debug</CardTitle>
        <CardDescription>Diagnose issues with your Supabase integration</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="text-lg font-medium mb-2">Environment Variables</h3>
          <ul className="space-y-2">
            {Object.entries(debugInfo.envVars).map(([key, exists]) => (
              <li key={key} className="flex items-center">
                {exists ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500 mr-2" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500 mr-2" />
                )}
                <span>
                  {key}: {exists ? "Defined" : "Not defined"}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-medium mb-2">Supabase Client</h3>
          <div className="flex items-center">
            {debugInfo.clientInitialized ? (
              <CheckCircle2 className="h-5 w-5 text-green-500 mr-2" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500 mr-2" />
            )}
            <span>Client initialized: {debugInfo.clientInitialized ? "Yes" : "No"}</span>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-medium mb-2">Connection Test</h3>
          <Alert variant={debugInfo.connectionTest.success ? "success" : "destructive"}>
            {debugInfo.connectionTest.success ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <AlertCircle className="h-5 w-5" />
            )}
            <AlertTitle>{debugInfo.connectionTest.success ? "Success" : "Error"}</AlertTitle>
            <AlertDescription>
              {debugInfo.connectionTest.message}
              {debugInfo.connectionTest.error && (
                <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                  {JSON.stringify(debugInfo.connectionTest.error, null, 2)}
                </pre>
              )}
            </AlertDescription>
          </Alert>
        </div>

        <div>
          <h3 className="text-lg font-medium mb-2">Table Test</h3>
          <Alert variant={debugInfo.tableTest.success ? "success" : "destructive"}>
            {debugInfo.tableTest.success ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
            <AlertTitle>{debugInfo.tableTest.success ? "Success" : "Error"}</AlertTitle>
            <AlertDescription>
              {debugInfo.tableTest.message}
              {debugInfo.tableTest.error && (
                <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                  {JSON.stringify(debugInfo.tableTest.error, null, 2)}
                </pre>
              )}
            </AlertDescription>
          </Alert>
        </div>

        <div>
          <h3 className="text-lg font-medium mb-2">Query Test</h3>
          <Alert variant={debugInfo.queryTest.success ? "success" : "destructive"}>
            {debugInfo.queryTest.success ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
            <AlertTitle>{debugInfo.queryTest.success ? "Success" : "Error"}</AlertTitle>
            <AlertDescription>
              {debugInfo.queryTest.message}
              {debugInfo.queryTest.data && (
                <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                  {JSON.stringify(debugInfo.queryTest.data, null, 2)}
                </pre>
              )}
              {debugInfo.queryTest.error && (
                <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                  {JSON.stringify(debugInfo.queryTest.error, null, 2)}
                </pre>
              )}
            </AlertDescription>
          </Alert>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={runDiagnostics} disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {loading ? "Running Diagnostics..." : "Run Diagnostics"}
        </Button>
      </CardFooter>
    </Card>
  )
}
