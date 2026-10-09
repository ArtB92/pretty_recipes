import { describe, expect, it } from "vitest";
import { captionFromInstagramEmbed, captionFromOgDescription } from "@/lib/social/parse";

describe("instagram caption extraction", () => {
  it("reads the embed page caption", () => {
    const html = `<div class="Caption"><a class="CaptionUsername" href="#">chef.lea</a><br />Tarte aux pommes &#x1f34e;<br/>200 g de farine<br>100 g de beurre<div class="CaptionComments"></div></div>`;
    expect(captionFromInstagramEmbed(html)).toEqual({ author: "@chef.lea", caption: "Tarte aux pommes 🍎\n200 g de farine\n100 g de beurre" });
  });
  it("reads og:description", () => {
    const html = `<meta property="og:description" content="1,234 likes, 56 comments - chef.lea on March 3, 2025: &quot;Easy pasta&#10;200 g spaghetti&quot;." />`;
    expect(captionFromOgDescription(html)).toEqual({ author: "@chef.lea", caption: "Easy pasta\n200 g spaghetti" });
  });
});
