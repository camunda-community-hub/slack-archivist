import { DiscourseAPI } from "../src/Discourse";

const post =
  "\\n\\n**Josh Wulf**: @archivist2\\n\\n**Josh Wulf**: @archivist2\\n\\n**Josh Wulf**: this is a thread\\n\\n**Josh Wulf**: @archivist2\\n\\n**Josh Wulf**: Another One!\\n\\n**Josh Wulf**: @archivist2\\n\\n**Josh Wulf**: shntnhsts\\n\\n**Josh Wulf**: @archivist2\\n\\n**Josh Wulf**: shntsnhts\\n\\n**Josh Wulf**: @archivist2\\n\\n**Josh Wulf**: @archivist2\\n\\n**Josh Wulf**: @archivist2\\n\\n**Josh Wulf**: @archivist2\\n\\n**Josh Wulf**: @archivist2\\n\\n**Josh Wulf**: @archivist2\\n\\n**Josh Wulf**: @archivist2\\n\\n**Josh Wulf**: @archivist2\\n\\n**Josh Wulf**: @archivist2\\n\\n**Josh Wulf**: @archivist2\\n\\n**Josh Wulf**: @archivist2\\n\\n**Josh Wulf**: @archivist2\\n\\n**Josh Wulf**: @archivist2 test post\\n\\n**archivist2**: Sorry! Something went wrong - please ask @Josh Wulf to take a look\\n\\n**Josh Wulf**: @archivist2 test post\\n\\n**archivist2**: Sorry! Something went wrong - please ask @Josh Wulf to take a look\\n\\n**Josh Wulf**: @archivist2 test post\\n\\n**archivist2**: Sorry! Something went wrong - please ask @Josh Wulf to take a look\\n\\n**Josh Wulf**: @archivist2 test post\\n\\n**Josh Wulf**: @archivist2 test post\\n\\n**archivist2**: Sorry! Something went wrong - please ask @Josh Wulf to take a look\\n\\n**archivist2**: Sorry! Something went wrong - please ask @Josh Wulf to take a look\\n\\n**Josh Wulf**: @archivist2 test post\\n\\n**archivist2**: Sorry! Something went wrong - please ask @Josh Wulf to take a look\\n\\n**Josh Wulf**: @archivist2 test post\\n\\n**archivist2**: Sorry! Something went wrong - please ask @Josh Wulf to take a look\\n\\n**Josh Wulf**: @archivist2 a new hope\\n\\n**archivist2**: Sorry! Something went wrong - please ask @Josh Wulf to take a look\\n\\n**Josh Wulf**: @archivist2 test post\\n\\n**archivist2**: Sorry! Something went wrong - please ask @Josh Wulf to take a look\\n\\n**Josh Wulf**: @archivist2 this is a test";

describe("Discourse API", () => {
  it("exists", () => {
    expect(DiscourseAPI).toBeTruthy();
  });
  //   it("can post", async () => {
  //     const discourse = new DiscourseAPI(configuration.discourse);
  //     try {
  //       const res = await discourse.post("this is a test post", post);
  //       console.log(res);
  //       expect(true).toBe(true);
  //     } catch (e) {
  //       console.log(e.message); //JSON.stringify(e.toJSON(), null, 2));
  //       expect(true).toBe(false);
  //     }
  //   });
});
