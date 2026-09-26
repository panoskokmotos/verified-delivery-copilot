import Link from "next/link";

export default function Home() {
  return (
    <main>
      <header>
        <h1>Verified Delivery Copilot</h1>
        <p>
          On giving platforms like Givelink, donors get a photo when their gift reaches the nonprofit. But anyone can now make a convincing
          delivery photo with a free AI tool in seconds. This agent checks that each photo is genuine and shows every item the donors gave,
          so the proof holds up for donors, for auditors, and for everyone who relies on it.
        </p>
      </header>

      <section className="card guide">
        <h2>Test it in 2 minutes</h2>
        <ol className="how-to">
          <li>
            <span className="num">1</span>
            <div>
              <div className="title">Be the nonprofit</div>
              <div className="sub">
                Open <Link href="/nonprofit">Deliveries</Link> and pick any delivery marked <b>Arrived</b>. Tap <b>Open camera</b> and
                photograph anything around you, or choose a photo.
              </div>
            </div>
          </li>
          <li>
            <span className="num">2</span>
            <div>
              <div className="title">Watch the agent check it</div>
              <div className="sub">
                About 15 to 40 seconds. Each product gets a green tick only if the photo shows it. A random photo is rejected; a photo of
                the donated items passes.
              </div>
            </div>
          </li>
          <li>
            <span className="num">3</span>
            <div>
              <div className="title">Send it, then be the donor</div>
              <div className="sub">
                Tap <b>Send proof</b>. Then open <Link href="/donor">Donors</Link> and pick one of that delivery&apos;s donors to see their
                items marked in the photo, the receipt, and the share link.
              </div>
            </div>
          </li>
        </ol>
        <div className="guide-try">
          <div className="title">Try to fool it</div>
          <ul>
            <li>An image made with ChatGPT or Gemini: stopped in step 1, before any model runs.</li>
            <li>A photo that shows only some of the items: a notice to the nonprofit, not a rejection.</li>
            <li>A photo for a delivery that hasn&apos;t arrived yet (Northgate): flagged.</li>
          </ul>
        </div>
        <div className="guide-cta">
          <Link className="btn gradient" href="/nonprofit">Start as the nonprofit</Link>
          <Link className="btn subtle" href="/try">Or check any photo against any request</Link>
        </div>
        <p className="sub" style={{ marginTop: 12 }}>
          The nonprofits and donors are fictional. Demo deliveries reset a few hours after a check, so the next person can try too.
        </p>
      </section>

      <div className="grid">
        <Link className="card role" href="/nonprofit">
          <span className="pill pending">Nonprofit</span>
          <div className="heading">Upload delivery proof</div>
          <p className="sub">See what donors sent, add one photo, and check every item before it goes to the donors.</p>
        </Link>
        <Link className="card role" href="/donor">
          <span className="pill success">Donor</span>
          <div className="heading">Track my gifts</div>
          <p className="sub">Follow each gift to the door, and see the checked photo once it lands.</p>
        </Link>
      </div>
      <footer>
        <Link href="/stats">Open delivery data</Link> · <a href="https://github.com/panoskokmotos/verified-delivery-copilot">Code (MIT)</a> · NVIDIA
        Nemotron on Nebius Token Factory · Built for the Nebius x NVIDIA Global AI Hackathon
      </footer>
    </main>
  );
}
