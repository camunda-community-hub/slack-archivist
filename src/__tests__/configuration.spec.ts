import { Configuration } from "../Configuration";

describe("configuration", () => {
  it("exists", () => {
    expect(Configuration).toBeTruthy();
  });
  it("validates", async () => {
    const config = await new Configuration().validate();
    console.log(config.missingRequiredKeys);
    expect(config.isValid).toBe(false);
  });
});
