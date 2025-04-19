import { GolfCoursesTable } from "@/components/golf-courses-table"

export default function Home() {
  return (
    <main className="container mx-auto py-8 px-4 min-h-screen flex flex-col">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Golf Course Rankings: United States</h1>
        <p className="text-muted-foreground">All the rankings, all the sources, all in one place.</p>
      </div>

      <div className="flex-grow">
        <GolfCoursesTable />
      </div>

      <footer className="mt-12 py-6 border-t text-center text-sm text-muted-foreground">
        built by{" "}
        <a href="https://twitter.com/yipsh" className="text-primary hover:underline">
          @yipsh
        </a>
      </footer>
    </main>
  )
}
