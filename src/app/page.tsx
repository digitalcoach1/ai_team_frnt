"use client"
import { SignedIn, SignedOut, SignInButton, SignUpButton, useUser } from "@clerk/nextjs"
import { ArrowRight, Sparkles, Users, Zap, Shield } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function Home() {
  const { user, isLoaded } = useUser()
  const router = useRouter()

  useEffect(() => {
    if (isLoaded && user) {
      router.push("/dashboard")
    }
  }, [isLoaded, user, router])

  return (
    <div className="min-h-screen bg-background">
      {/* Landing Page - Shown when signed out */}
      <SignedOut>
        {/* Hero Section */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20" />
          <div className="relative max-w-7xl mx-auto px-6 py-24 sm:py-32">
            <div className="text-center max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8">
                <Sparkles className="w-4 h-4" />
                <span>AI-Powered Team Collaboration</span>
              </div>
              <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-balance mb-6">
                Build Better Together with{" "}
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  AI Team
                </span>
              </h1>
              <p className="text-xl text-muted-foreground text-pretty mb-10 leading-relaxed">
                Supercharge your team's productivity with AI-powered collaboration tools. Work smarter, communicate
                better, and achieve more together.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <SignUpButton mode="modal" forceRedirectUrl="/dashboard">
                  <button className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-lg font-semibold text-base h-12 px-8 hover:opacity-90 transition-opacity">
                    Get Started Free
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </SignUpButton>
                <SignInButton mode="modal" forceRedirectUrl="/dashboard">
                  <button className="inline-flex items-center justify-center gap-2 bg-secondary text-secondary-foreground rounded-lg font-semibold text-base h-12 px-8 hover:opacity-90 transition-opacity">
                    Sign In
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </SignInButton>
                <a
                  href="#features"
                  className="inline-flex items-center justify-center rounded-lg border border-border font-semibold text-base h-12 px-8 hover:bg-accent transition-colors"
                >
                  Learn More
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24 bg-muted/30">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Everything Your Team Needs</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Powerful features designed to help your team collaborate seamlessly
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-card rounded-xl p-8 border border-border hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center mb-4">
                  <Zap className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-xl font-semibold mb-3">AI-Powered Insights</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Get intelligent suggestions and insights to help your team make better decisions faster.
                </p>
              </div>
              <div className="bg-card rounded-xl p-8 border border-border hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center mb-4">
                  <Users className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Real-Time Collaboration</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Work together seamlessly with real-time updates and instant communication.
                </p>
              </div>
              <div className="bg-card rounded-xl p-8 border border-border hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center mb-4">
                  <Shield className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Enterprise Security</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Your data is protected with enterprise-grade security and compliance standards.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold mb-6">Ready to Transform Your Team?</h2>
            <p className="text-lg text-muted-foreground mb-10">
              Join thousands of teams already using AI Team to work smarter.
            </p>
            <SignUpButton mode="modal" forceRedirectUrl="/dashboard">
              <button className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-lg font-semibold text-base h-12 px-8 hover:opacity-90 transition-opacity">
                Start Free Today
                <ArrowRight className="w-5 h-5" />
              </button>
            </SignUpButton>
          </div>
        </section>
      </SignedOut>

      <SignedIn>
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-muted-foreground">Redirecting to dashboard...</p>
        </div>
      </SignedIn>
    </div>
  )
}
