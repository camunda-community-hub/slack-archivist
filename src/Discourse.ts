// https://docs.discourse.org/
// https://meta.discourse.org/t/how-to-reverse-engineer-the-discourse-api/20576
// https://meta.discourse.org/t/how-to-turn-off-a-checker-for-title-seems-unclear-is-it-a-complete-sentence/55070/12
import Axios from "axios";
import * as E from "fp-ts/Either";
import { DiscourseConfigObject } from "./lib/Configuration";

export class DiscourseAPI {
  private http: any;
  private config: DiscourseConfigObject;
  constructor(config: DiscourseConfigObject) {
    // To get your category id
    // http
    //   .get(`/categories`)
    //   .then(res => console.log(JSON.stringify(res.data, null, 2)));
    this.config = config;
    this.http = Axios.create({
      baseURL: config.url,
      headers: {
        "Api-Key": config.token,
        "Api-Username": config.user,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });
  }

  async post(
    title: string,
    discoursePost: string
  ): Promise<E.Either<Error, string>> {
    return this.http
      .post("/posts.json", {
        title,
        raw: discoursePost,
        category: this.config.category,
      })
      .then(({ data }) =>
        E.right(`${this.config.url}t/${data.topic_slug}/${data.topic_id}`)
      )
      .catch((e) => E.left(new Error(e?.response?.data?.errors || e.message)));
  }
}
