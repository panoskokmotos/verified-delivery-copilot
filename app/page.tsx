import Link from "next/link";

export default function Home() {
  return (
    <main>
      <header>
        <h1>Verified Delivery Copilot</h1>
        <p>
          Donors give goods, then rarely learn if they arrived. Here the nonprofit uploads one delivery photo, an agent checks every item
          the donor gave and whether the photo is genuine, and the donor gets a receipt only when it proves the delivery.
        </p>
      </header>
      <div className="grid">
        <Link className="card role" href="/nonprofit">
          <h2>I'm a nonprofit</h2>
          <div className="title">Upload proof of a delivery</div>
          <p className="sub">See the gifts waiting for a photo, upload it, and watch the checks run.</p>
        </Link>
        <Link className="card role" href="/donor">
          <h2>I'm a donor</h2>
          <div className="title">See where my gifts went</div>
          <p className="sub">Each gift shows its status, and the photo and receipt once confirmed.</p>
        </Link>
      </div>
      <footer>
        <Link href="/try">Try any photo</Link> · Demo data, fictional nonprofits. Built for the Nebius x NVIDIA Global AI Hackathon on Nebius Token Factory.
      </footer>
    </main>
  );
}
