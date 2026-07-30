import VideoPlayer from "@/components/VideoPlayer";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
      <section className="w-full max-w-5xl">
        <h1 className="text-2xl font-bold text-zinc-100 text-center mb-8 tracking-tight">
          Video Player
        </h1>
        <VideoPlayer />
      </section>
    </main>
  );
}
