import Image from "next/image"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { currentUser } from "@clerk/nextjs/server"
import { UserButton } from "@clerk/nextjs"

const agents = [
  {
    name: "Alex AI",
    role: "Cross-Platform ADs Manager",
    image: "https://www.ai-scaleup.com/wp-content/uploads/2025/03/David-AI-Ai-Specialist-social-ads.png",
    href: "/dashboard/alex-ai",
  },
  {
    name: "Tony AI",
    role: "Direttore Commerciale",
    image: "https://www.ai-scaleup.com/wp-content/uploads/2025/02/Tony-AI-strategiest.png",
    href: "/dashboard/tony-ai",
  },
  {
    name: "Aladino AI",
    role: "Creatore di nuove offerte e prodotti",
    image: "https://www.ai-scaleup.com/wp-content/uploads/2025/02/Aladdin-AI-consultant.png",
    href: "/dashboard/aladino-ai",
  },
  {
    name: "Lara AI",
    role: "Social Media Manager",
    image: "https://www.ai-scaleup.com/wp-content/uploads/2025/02/Lara-AI-social-strategiest.png",
    href: "/dashboard/lara-ai",
  },
  {
    name: "Simone AI",
    role: "SEO Copywriter",
    image: "https://www.ai-scaleup.com/wp-content/uploads/2025/02/Simone-AI-seo-copy.png",
    href: "/dashboard/simone-ai",
  },
  {
    name: "Mike AI",
    role: "Direttore Marketing",
    image: "https://www.ai-scaleup.com/wp-content/uploads/2025/02/Mike-AI-digital-marketing-mg.png",
    href: "/dashboard/mike-ai",
  },
  {
    name: "Valentina AI",
    role: "SEO Optimizer",
    image: "https://www.ai-scaleup.com/wp-content/uploads/2025/03/Valentina-AI-AI-SEO-optimizer.png",
    href: "/dashboard/valentina-ai",
  },
  {
    name: "Niko AI",
    role: "SEO Manager",
    image: "https://www.ai-scaleup.com/wp-content/uploads/2025/02/Niko-AI.png",
    href: "/dashboard/niko-ai",
  },
  {
    name: "Jim AI",
    role: "Coach di Vendite",
    image: "https://www.ai-scaleup.com/wp-content/uploads/2025/02/Jim-AI-%E2%80%93-AI-Coach.png",
    href: "/dashboard/jim-ai",
  },
  {
    name: "Daniele AI",
    role: "Copywriter per Vendere (Direct Response)",
    image: "https://www.ai-scaleup.com/wp-content/uploads/2025/11/daniele_ai_direct_response_copywriter.png",
    href: "/dashboard/daniele-ai",
  },
]

export default async function HomePage() {
  const user = await currentUser()

  return (
    <div className="min-h-screen bg-muted">
      <div className="mx-auto w-[90%] max-w-[1200px] py-10">
        {/* Header Section */}
        <header className="relative mb-12 rounded-xl bg-[#235E84] px-5 py-[30px] text-center shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05),0_2px_4px_-1px_rgba(0,0,0,0.03)]">
          {user && (
            <div className="absolute right-5 top-5">
              <UserButton />
            </div>
          )}
          <h1 className="mb-2 font-sans text-[36px] font-bold leading-tight text-white">
            Incontra i nostri Specialisti AI
          </h1>
          <p className="text-lg text-white/90">Scegli un agente AI e avvia la conversazione con un clic.</p>
        </header>

        {/* Agents Grid */}
        <main className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {agents.map((agent) => (
            <Link key={agent.name} href={agent.href} className="group">
              <Card className="overflow-hidden border border-border bg-card shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05),0_2px_4px_-1px_rgba(0,0,0,0.03)] transition-all duration-300 hover:-translate-y-[5px] hover:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.07),0_4px_6px_-2px_rgba(0,0,0,0.04)]">
                {/* Agent Avatar */}
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-white">
                  <Image
                    src={agent.image || "/placeholder.svg"}
                    alt={agent.name}
                    fill
                    className="object-contain transition-transform duration-300 group-hover:scale-105"
                  />
                </div>

                {/* Agent Info */}
                <div className="p-6">
                  <h3 className="mb-2 font-sans text-[20px] font-semibold text-card-foreground">{agent.name}</h3>
                  <p className="text-sm text-muted-foreground">{agent.role}</p>
                </div>
              </Card>
            </Link>
          ))}
        </main>
      </div>
    </div>
  )
}
