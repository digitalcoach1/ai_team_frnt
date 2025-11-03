import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card } from "@/components/ui/card"
import { MoreHorizontal } from "lucide-react"
import Link from "next/link"

const names = [
  { name: "Jim AI", initials: "JA", color: "from-blue-500 to-cyan-500", href: "/dashboard/jim-ai" }, // Updated href to link to Jim AI page
  { name: "Alex AI", initials: "AA", color: "from-purple-500 to-pink-500", href: "/dashboard//alex-ai" },
  { name: "Mike AI", initials: "MA", color: "from-orange-500 to-red-500", href: "/dashboard//mike-ai" }, // Updated href to link to Mike AI page
  { name: "Tony AI", initials: "TA", color: "from-green-500 to-emerald-500", href: "/dashboard//tony-ai" }, // Updated href to link to Tony AI page
  { name: "Lara AI", initials: "LA", color: "from-yellow-500 to-orange-500", href: "/dashboard//lara-ai" }, // Updated href to link to Lara AI page
  { name: "Leiz AI", initials: "LZ", color: "from-indigo-500 to-purple-500", href: "#" },
  { name: "Valentina AI", initials: "VA", color: "from-pink-500 to-rose-500", href: "/dashboard//valentina-ai" }, // Updated href to link to Valentina AI page
  { name: "Daniele", initials: "DA", color: "from-teal-500 to-cyan-500", href: "/dashboard//daniele-ai" }, // Updated href to link to Daniele AI page
  { name: "Simone", initials: "SI", color: "from-violet-500 to-purple-500", href: "/dashboard//simone-ai" }, // Updated href to link to Simone AI page
  { name: "Wonder", initials: "WO", color: "from-amber-500 to-yellow-500", href: "#" },
  { name: "Niko", initials: "NI", color: "from-sky-500 to-blue-500", href: "#" },
  { name: "Leo", initials: "LE", color: "from-emerald-500 to-green-500", href: "#" },
  { name: "Laura", initials: "LU", color: "from-rose-500 to-pink-500", href: "#" },
]

export default function Page() {
  return (
    <div className="min-h-screen bg-white p-6">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {names.map((person, index) => (
            <Link key={index} href={person.href}>
              <Card className="group relative flex items-center gap-4 border-gray-200 bg-white p-4 transition-all hover:border-gray-300 hover:bg-gray-50 cursor-pointer">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className={`bg-gradient-to-br ${person.color} text-white font-semibold`}>
                    {person.initials}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1">
                  <h3 className="font-medium text-black">{person.name}</h3>
                </div>

                <button className="opacity-0 transition-opacity group-hover:opacity-100">
                  <MoreHorizontal className="h-5 w-5 text-gray-600" />
                </button>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
