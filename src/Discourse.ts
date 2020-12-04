// https://docs.discourse.org/
// https://meta.discourse.org/t/how-to-reverse-engineer-the-discourse-api/20576
// https://meta.discourse.org/t/how-to-turn-off-a-checker-for-title-seems-unclear-is-it-a-complete-sentence/55070/12
import Axios, { AxiosInstance } from "axios";
import * as E from "fp-ts/Either";
import { DiscourseConfigObject } from "./lib/Configuration";
import { RateLimiter } from "./lib/Ratelimiter";

const debug = require("debug")("discourse");

export interface DiscourseSuccessMessage {
  url: string;
  baseURL: string;
  topic_slug: string;
  topic_id: number;
}

export class DiscourseAPI {
  private http: AxiosInstance;
  private config: DiscourseConfigObject;
  private limit: RateLimiter;
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
    this.limit = new RateLimiter(500);
  }

  async addToPost(
    topic_id: number,
    raw: string
  ): Promise<E.Either<Error, DiscourseSuccessMessage>> {
    return this.limit.runRateLimited({
      task: () =>
        this.http
          .post("/posts.json", {
            topic_id,
            raw: raw,
            category: this.config.category,
          })
          .then(({ data }) =>
            E.right({
              url: `${this.config.url}t/${data.topic_slug}/${data.topic_id}`,
              baseURL: this.config.url,
              topic_slug: data.topic_slug,
              topic_id: data.topic_id,
            })
          )
          .catch((e) =>
            E.left(new Error(e?.response?.data?.errors || e.message))
          ),
    });
  }

  async createNewPost(
    title: string,
    discoursePost: string
  ): Promise<E.Either<Error, DiscourseSuccessMessage>> {
    return this.limit.runRateLimited({
      task: () =>
        this.http
          .post("/posts.json", {
            title,
            raw: discoursePost,
            category: this.config.category,
          })
          .then(({ data }) =>
            E.right({
              url: `${this.config.url}t/${data.topic_slug}/${data.topic_id}`,
              baseURL: this.config.url,
              topic_slug: data.topic_slug,
              topic_id: data.topic_id,
            })
          )
          .catch((e) =>
            E.left(new Error(e?.response?.data?.errors || e.message))
          ),
    });
  }

  async getPost(topic_id: number) {
    const req = `/t/${topic_id}.json`;
    debug(`Request url: ${req}`);
    return this.limit
      .runRateLimited({
        task: () => this.http.get(req),
      })
      .catch((e) => {
        debug(e);
        if (e.response?.status) {
          return { status: 400 };
        }
        return false as false;
      });
  }

  async uploadFile(file: string) {
    return this.limit.runRateLimited({
      task: () =>
        this.http
          .post("/uploads.json", {
            file,
            synchronous: true,
          })
          .then(({ data }) => ({
            url: data.url,
          }))
          .catch((e) => {
            console.error("Error uploading file to Discourse", e);
            return null;
          }),
    });
  }
}
