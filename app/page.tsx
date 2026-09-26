import Link from "next/link";

export default function Home() {
  return (
    <main>
      <header>
        <h1>Verified Delivery Copilot</h1>
        <p>
          Donors give goods, then rarely learn if they arrived. Here the nonprofit uploads one delivery photo, an agent checks every item the
          donor gave and whether the photo is genuine, and the donor gets the proof only when it holds up.
        </p>
      </header>
      <div className="grid">
        <Link className="card role" href="/nonprofit">
          <span className="pill pending">Nonprofit</span>
          <div className="heading">Upload delivery proof</div>
          <p className="sub">See what donors sent, add one photo, and check every item before it goes to the donor.</p>
        </Link>
        <Link className="card role" href="/donor">
          <span className="pill success">Donor</span>
          <div className="heading">Track my gifts</div>
          <p className="sub">Follow each gift to the door, and see the checked photo once it lands.</p>
        </Link>
      </div>
      <footer>
        <Link href="/try">Try any photo</Link> · <Link href="/stats">Open delivery data</Link> · Demo data with fictional nonprofits · Built for the Nebius x NVIDIA Global AI Hackathon on Nebius Token Factory
      </footer>
    </main>
  );
}
