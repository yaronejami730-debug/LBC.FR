import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // Create admin user
  await prisma.user.upsert({
    where: { email: "admin@presdetoi.fr" },
    update: {},
    create: {
      email: "admin@presdetoi.fr",
      password: await bcrypt.hash("admin1234!", 12),
      name: "Admin",
      role: "ADMIN",
      verified: true,
      memberSince: 2024,
    },
  });

  // Create users
  const alice = await prisma.user.upsert({
    where: { email: "alice@example.com" },
    update: {},
    create: {
      email: "alice@example.com",
      password: await bcrypt.hash("password123", 12),
      name: "Alice Martin",
      verified: true,
      memberSince: 2021,
      avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuAdQBmfdMkaX3Y18Zs9iFAnF0j11Nv4uuEM7ngqeyfS398ggGwaCKfSYDKAMp0NkNpigvlgIakaIBJIGMkOlaTrQYnFpfDnsQmA0cib1_vuqg_94C8fmjXVOHN6QmttMbWOipZY3gqfkFrGPGyrY42qOA4x33RcZ5Py-_7CGe5FRWI5uR16tiWscpET01rr7hxYbcKcuXPsbo97c6nikFSglvVhLenJY109S45NRDDRgO481-D02lfdn1cJPOHt6Hy0zYF7WC_rGwmu",
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: "bob@example.com" },
    update: {},
    create: {
      email: "bob@example.com",
      password: await bcrypt.hash("password123", 12),
      name: "Bob Dupont",
      verified: false,
      memberSince: 2023,
    },
  });

  const carol = await prisma.user.upsert({
    where: { email: "carol@example.com" },
    update: {},
    create: {
      email: "carol@example.com",
      password: await bcrypt.hash("password123", 12),
      name: "Carol Smith",
      verified: true,
      memberSince: 2022,
      avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuDTr8UvcnTLAJpchQPwo1HyiumcN9hHF-U5maOvfYAXqo8ne_Uy6Gw6TIW_BetzF9M5VUX3-S3Dx8RTtd8Jk1cmwBjqCGexiZnvZAP7LE5pqAo9lya9CZRkXzopDfGady9Jb_R-QS60XdpqmTSVwL0E3sfENtfmF_OnSPaE2qGIbJHSwIUTSIZAXAzFk4HnPezB8W8Z9alwf7NDZdA2mWMrTvSWifJRppk0jCxxt8cD3EBGq5N_vWFinK1taPKGbJTnQNOGB5ZNd3cc",
    },
  });

  // Create listings
  const listings = [
    {
      title: "Mid-Century Modern Velvet Sofa - Emerald Edition",
      description: "Experience the pinnacle of sophisticated living with our limited-edition Emerald Edition sofa. Handcrafted with a focus on both comfort and architectural integrity, this piece features a solid oak frame and high-density foam cushions wrapped in premium, spill-resistant Italian velvet.\n\nWhether you're anchoring a minimalist living room or adding a pop of color to a professional studio, the deep forest tones and tapered walnut legs offer a timeless aesthetic.",
      price: 1250,
      category: "Meubles",
      location: "Paris, FR",
      condition: "Très bon état",
      brand: "Heirloom Co.",
      material: "Italian Velvet",
      isPremium: true,
      images: JSON.stringify(["https://lh3.googleusercontent.com/aida-public/AB6AXuAwwxQgv4rI6XClzhTLjkwXug8TYby1cyK7AgQhc4UpMdyrjwq4jRPQo_ZvL_7xvjhVSon_iJvztv0bdEqqiFX0CHRW9IDYjccZpyP4v8zoDq0pcj4RtADoGgiXgRyW1_sPXiKqwZz8D1UwMIYilwBQMOTHJ4RMQl9Rp4vFbK6a0UCsy93TZ3-DYA8qYhHPO4LhM2csSFfFLlOh2P8D7w00bjyGrSMRlGSvhxZrGjVcqJUJ2-2y9XbKHb7ww02PREvAIJO3_wJ41hV5"]),
      userId: alice.id,
    },
    {
      title: "BMW 3 Series M-Sport 2023",
      description: "Barely used BMW 3 Series with M-Sport package. Full service history, one owner. Features include heads-up display, Harman Kardon sound system, and adaptive suspension.",
      price: 42500,
      category: "Véhicules",
      location: "Lyon, FR",
      condition: "Très bon état",
      brand: "BMW",
      isPremium: false,
      images: JSON.stringify(["https://lh3.googleusercontent.com/aida-public/AB6AXuCfOF5vPmO9u7Dm-gKT2r-VQbM-XRUHDszGOhgw9nQme7ezVzWVHxC4bF5zGdu7Keg7zh6_WonxQ7X8kNUGPZV3fvOJrcmifiIUiUuFhE6gVHhq1Ppz-R5kbo-sGKmsilinflMQYZq6_XdYEIuhJyL0GKxKzx90bIgN90h9bHWhfsLuKkGHwPzNfA0QSDRwgMjCe0EymCr5MFA_bX1eix347LvuqVGZqk9-rvf4YTHGpvET6izbWT6WoXzyr9WdDosf8AwFIQuo-9Fv"]),
      userId: alice.id,
    },
    {
      title: "MacBook Pro 16\" M2 Max",
      description: "MacBook Pro 16-inch with M2 Max chip. 32GB RAM, 1TB SSD. AppleCare+ until 2025. Comes with original box, charger, and USB-C hub. In perfect condition.",
      price: 2800,
      category: "Électronique",
      location: "Paris, FR",
      condition: "Bon état",
      brand: "Apple",
      isPremium: false,
      images: JSON.stringify(["https://lh3.googleusercontent.com/aida-public/AB6AXuBNky6XKHzRs5CIZGeWIzyViYUzxzaruHOB-hgJoaeMgiV69KLaB5B0Rs54D1CD_JlRpAunavPPSxAVQiOdm7buj-che2bkf_MgFMXzpz3DtMWFqu7xDvTe7KKnmd3Fc9mOzULRDDFXZPOuJs0b6r0A5nJ5q-2XEuEv8MZeJGkHXGLXbEVxLuRaVXyyUuWep7YTUfAZY9JufGSP7ZmCQdAFKOovHRgYR8kB6oHg01BHKoBahrkA583KK1xGeY48R44OSVGZL373_863"]),
      userId: bob.id,
    },
    {
      title: "3-Bed Modern Penthouse",
      description: "Stunning 3-bedroom penthouse with panoramic city views. Fully furnished, 24/7 concierge, private rooftop terrace. Available immediately.",
      price: 1200000,
      category: "Immobilier",
      location: "Bordeaux, FR",
      condition: "Neuf",
      isPremium: true,
      images: JSON.stringify(["https://lh3.googleusercontent.com/aida-public/AB6AXuBGoKTXok1NT6s9KEf2frbnpM1rC6LxHe6wrElBJUbjC5Zeism61HxiYhp_ZfLA6kQtBEtq6bz6ZCkFdkZDXZlGlMevPgciRT_KdxMBBtDK1ndg9a1_uO6eKuR6Yhr7GSBW1HtDY9qnpEBn_rt9bAtPEa-goaoD8j_3puNXfQoFgHc86ntWnF_Jl3jJpRvgqI-s6dMq6Xwttu9QkEp9pzd-1cItxMl46UfR6VXMM9DI7tN5QduSwQTSbC8iPBg_ISnsZ_PN6n9OX4_v"]),
      userId: carol.id,
    },
    {
      title: "Pro-Series Studio Headphones",
      description: "Professional studio headphones with 40mm drivers and noise isolation. Perfect for mixing and mastering. Includes detachable cable and carrying case.",
      price: 320,
      category: "Électronique",
      location: "Marseille, FR",
      condition: "Très bon état",
      brand: "Beyerdynamic",
      isPremium: false,
      images: JSON.stringify(["https://lh3.googleusercontent.com/aida-public/AB6AXuD3Xfnyr6hWoZwIwRffqEqMFhyIT2PwZS4oQD2Q6Q_u9QwbGyxRaiS7Icki0Joz0vfVAsNMmSnyw6_0dB3W0OZBCeK7K7TZ_EsJvdNWlLyBnUPoluSMcajClpZWDP43SdfWn34aHd9BfO-wWy8lcgjqfY-JauUhAWImTy0dpSVOpMOx_WRBG7t93RH9dcyMr3yOUDpzETvJID0VLmnOxfIypO1mNM7kmWK9YCK1A8YzMha4WW1A7P-6Jd4Ce522lPnNx5d0kga58v32"]),
      userId: bob.id,
    },
    {
      title: "Heritage Gold Minimalist Timepiece",
      description: "Elegant minimalist watch with Swiss movement. White dial, gold case, leather strap. Worn only a few times. Comes with original box and papers.",
      price: 450,
      category: "Mode",
      location: "Paris, FR",
      condition: "Très bon état",
      brand: "Tissot",
      isPremium: false,
      images: JSON.stringify(["https://lh3.googleusercontent.com/aida-public/AB6AXuAgU9IAViKJ8KaVZvqJIaGg1mKrLiMAOpoMHy-Tk2IIbv0raFnTLx7tm-auuoHsv4R_lpBf_Rx9jcsvhzYhmNd8neQ-_nZ86X37UHQwjW_FHdN0wczaNnSWf4E9wOdjezw1yp6ahfOSlC_i9tMMUI-qwvmyLOv_Xrm5QrG48dCszhxPCP_VBuKUVyXdLXNWOI3nu2f1WrB-m0LtkdOz8XDaJ7FAVM4_Mxvi3JjXe0TcAnqPDmIBLgE3vltJIS_s4IVHeBQ10sGMH8a8"]),
      userId: alice.id,
    },
    {
      title: "Apex 4K Cinematic Drone",
      description: "High-performance 4K drone with 3-axis gimbal, 30-minute flight time, obstacle avoidance. Includes extra batteries, carrying bag, and ND filter set.",
      price: 850,
      category: "Électronique",
      location: "Nantes, FR",
      condition: "Bon état",
      brand: "DJI",
      isPremium: false,
      images: JSON.stringify(["https://lh3.googleusercontent.com/aida-public/AB6AXuA5RUISjG9GWc05OWTUfBNNYM1aSL5cEvI4WhyOt8RLrKvLuHl2E3RIaW8yctilpF-isjGgkLiEJkHQULtCt0DnDIEwAp9hy_4O0Db9RS-ecLZi1FEUVtAxfKgq25vsvWFzfkO2UKECYE7pccmJEtmUsd04ydPq8eKh4jNg3ndNdqReZLOAtVF9tF1NL9hJTuZVAWonKlLmDZCI4zS-DP1DsmRk2heSvrcNdyzStUjWH7IPabUkQ-1n2n6xJ6GKfy92GmWnm0DxIlWL"]),
      userId: carol.id,
    },
    {
      title: "Ultra-Minimalist Executive Workstation",
      description: "Complete workstation setup: 27\" 4K monitor, mechanical keyboard, wireless mouse, laptop stand, and cable management system. Perfect for remote work.",
      price: 1299,
      category: "Électronique",
      location: "Strasbourg, FR",
      condition: "Bon état",
      isPremium: true,
      images: JSON.stringify(["https://lh3.googleusercontent.com/aida-public/AB6AXuD2AxM7ifdQJO1Vcbfe1SLSpLPmVRbHf1MWUE0oOEePKjotSehfmh35tUH2T_dYWOS7B5mHIoguZMafYI8SNneUPtGEuL5_5rGLNkBGI6FXDeT3MbnNT8ipp9cVaA_DjE3j7-V3i4DQ1kt6ccpnxhHHPLK9wtq2S_LqrPaN-vxu1PaIGgMlDV-2iwYsUwf1NqBCNuNsUv_eCR6udh16zVCjkrMCbEeQR5U7Cgg1kp7Fd9jLErXccikIvZdR1Hi1RzNRfjPial-UBQnd"]),
      userId: bob.id,
    },
  ];

  for (const data of listings) {
    await prisma.listing.create({ data: { ...data, status: "APPROVED" } });
  }

  console.log(`✓ Created ${listings.length} listings`);
  console.log("✓ Created 4 users:");
  console.log("  admin@presdetoi.fr / admin1234!  (ADMIN)");
  console.log("  alice@example.com  / password123");
  console.log("  bob@example.com    / password123");
  console.log("  carol@example.com  / password123");
  console.log("\nDatabase seeded successfully!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
