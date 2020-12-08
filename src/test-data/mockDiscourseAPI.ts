import * as E from "fp-ts/Either";

export const discourseAPI = {
  uploadFile: async (file: string): Promise<E.Either<Error, { url: string }>> =>
    E.right("some-url") as any,
};
