"use server";

import mongoose, { FilterQuery } from "mongoose";
import { revalidatePath } from "next/cache";

import ROUTES from "@/constants/routes";
import Question, { IQuestionDoc } from "@/database/question.model";
import TagQuestion from "@/database/tag-question.model";
import Tag, { ITagDoc } from "@/database/tag.model";

import action from "../handlers/action";
import handleError from "../handlers/error";
import {
  AskQuestionSchema,
  EditQuestionSchema,
  GetQuestionSchema,
  IncrementViewsSchema,
  PaginatedSearchParamsSchema,
} from "../validations";

export async function createQuestion(
  params: CreateQuestionParams
  // ActionResponse contains the Question
): Promise<ActionResponse<Question>> {
  const validationResult = await action({
    params,
    schema: AskQuestionSchema,
    authorize: true,
  });

  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  const { title, content, tags } = validationResult.params!;
  const userId = validationResult?.session?.user?.id;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const [question] = await Question.create(
      [{ title, content, author: userId }],
      { session }
    );

    if (!question) {
      throw new Error("Failed to create question");
    }

    const tagIds: mongoose.Types.ObjectId[] = [];
    const tagQuestionDocuments = [];

    for (const tag of tags) {
      const existingTag = await Tag.findOneAndUpdate(
        { name: { $regex: new RegExp(`^${tag}$`, "i") } },
        { $setOnInsert: { name: tag }, $inc: { questions: 1 } },
        { upsert: true, new: true, session }
      );

      tagIds.push(existingTag._id);
      tagQuestionDocuments.push({
        tag: existingTag._id,
        question: question._id,
      });
    }

    await TagQuestion.insertMany(tagQuestionDocuments, { session });

    await Question.findByIdAndUpdate(
      question._id,
      { $push: { tags: { $each: tagIds } } },
      { session }
    );

    await session.commitTransaction();

    return { success: true, data: JSON.parse(JSON.stringify(question)) };
  } catch (error) {
    await session.abortTransaction();
    return handleError(error) as ErrorResponse;
  } finally {
    session.endSession();
  }
}

export async function editQuestion(
  params: EditQuestionParams
): Promise<ActionResponse<IQuestionDoc>> {
  const validationResult = await action({
    params,
    schema: EditQuestionSchema,
    authorize: true,
  });

  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  const { title, content, tags, questionId } = validationResult.params!;
  const userId = validationResult?.session?.user?.id;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const question = await Question.findById(questionId).populate("tags");
    // console.log("🚀 ~ question:", question);

    if (!question) {
      throw new Error("Question not found");
    }

    if (question.author.toString() !== userId) {
      throw new Error("Unauthorized");
    }

    if (question.title !== title || question.content !== content) {
      question.title = title;
      question.content = content;
      await question.save({ session });
    }

    const tagsToAdd = tags.filter(
      (tag) =>
        !question.tags.some((t: ITagDoc) =>
          t.name.toLowerCase().includes(tag.toLowerCase())
        )
    );
    console.log("🚀 ~ tagsToAdd:", tagsToAdd);

    const tagsToRemove = question.tags.filter(
      (tag: ITagDoc) =>
        !tags.some((t) => t.toLowerCase() === tag.name.toLowerCase())
    );

    const newTagDocuments = [];

    if (tagsToAdd.length > 0) {
      for (const tag of tagsToAdd) {
        const existingTag = await Tag.findOneAndUpdate(
          { name: { $regex: `^${tag}$`, $options: "i" } },
          { $setOnInsert: { name: tag }, $inc: { questions: 1 } },
          { upsert: true, new: true, session }
        );

        if (existingTag) {
          newTagDocuments.push({
            tag: existingTag._id,
            question: questionId,
          });

          question.tags.push(existingTag._id);
        }
      }
    }

    if (tagsToRemove.length > 0) {
      const tagIdsToRemove = tagsToRemove.map((tag: ITagDoc) => tag._id);

      await Tag.updateMany(
        { _id: { $in: tagIdsToRemove } },
        { $inc: { questions: -1 } },
        { session }
      );

      await TagQuestion.deleteMany(
        { tag: { $in: tagIdsToRemove }, question: questionId },
        { session }
      );

      question.tags = question.tags.filter(
        (tag: mongoose.Types.ObjectId) =>
          !tagIdsToRemove.some((id: mongoose.Types.ObjectId) =>
            id.equals(tag._id)
          )
      );
    }

    if (newTagDocuments.length > 0) {
      await TagQuestion.insertMany(newTagDocuments, { session });
    }

    await question.save({ session });
    await session.commitTransaction();

    return { success: true, data: JSON.parse(JSON.stringify(question)) };
  } catch (error) {
    await session.abortTransaction();
    return handleError(error) as ErrorResponse;
  } finally {
    await session.endSession();
  }
}

export async function getQuestion(
  params: GetQuestionParams
): Promise<ActionResponse<Question>> {
  const validationResult = await action({
    params,
    schema: GetQuestionSchema,
    authorize: true,
  });

  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  const { questionId } = validationResult.params!;

  try {
    //  Metoda populate("tags") bierze te ID i automatycznie wykonuje dodatkowe zapytanie (lub zapytania) do bazy danych, aby pobrać pełne dokumenty Tag, które odpowiadają tym ID.
    // Dzięki temu, zamiast pracować z samymi ID, możesz bezpośrednio pracować z danymi tagów, co jest szczególnie przydatne przy wyświetlaniu informacji lub dalszym przetwarzaniu danych.
    // const question = await Question.findById(questionId).populate("tags");
    const question = await Question.findById(questionId).populate([
      { path: "author", select: "name image" },
      { path: "tags", select: "name" },
    ]);

    // secon version also works well -   const question = await Question.findById(questionId).populate("tags").populate("author", "_id name image");
    // TODO: HERE
    if (!question) {
      throw new Error("Question not found");
    }
    // W Mongoose, dokumenty mają dodatkowe metody i właściwości, które nie są potrzebne przy przesyłaniu danych do klienta (np. metody jak save, validate, czy właściwości jak __v). Serializacja do JSON i natychmiastowa deserializacja usuwa te dodatkowe właściwości, dając czysty obiekt danych bez metod Mongoose.
    return { success: true, data: JSON.parse(JSON.stringify(question)) };
  } catch (error) {
    return handleError(error) as ErrorResponse;
  }
}

export async function getQuestions(
  params: PaginatedSearchParams
): Promise<ActionResponse<{ questions: Question[]; isNext: boolean }>> {
  const validationResult = await action({
    params,
    schema: PaginatedSearchParamsSchema,
  });

  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }
  const { page = 1, pageSize = 10, query, filter } = params;
  const skip = (Number(page) - 1) * pageSize;
  const limit = Number(pageSize);

  const filterQuery: FilterQuery<typeof Question> = {};

  // TODO: WE BULD THE LOGIC LATER;
  if (filter === "recommended") {
    return { success: true, data: { questions: [], isNext: false } };
  }

  if (query) {
    filterQuery.$or = [
      { title: { $regex: new RegExp(query, "i") } }, // don't care about capitalization
      { content: { $regex: new RegExp(query, "i") } },
    ];
  }

  let sortCriteria = {};

  switch (filter) {
    case "newest":
      sortCriteria = { createdAt: -1 }; // from newest to oldest
      break;
    case "unanswered":
      filterQuery.answers = 0;
      sortCriteria = { createdAt: -1 };
      break;
    case "popular":
      sortCriteria = { upvotes: -1 };
      break;
    default:
      sortCriteria = { createdAt: -1 };
      break;
  }

  try {
    // throw new Error("erorrrr");

    const totalQuestions = await Question.countDocuments(filterQuery);

    const questions = await Question.find(filterQuery)
      .populate([
        { path: "author", select: "name image" },
        { path: "tags", select: "name" },
      ])
      // .populate("author", "name image email _id")
      .lean() // convert into js object
      .sort(sortCriteria)
      .skip(skip)
      .limit(limit);

    const isNext = totalQuestions > skip + questions.length;

    return {
      success: true,
      // JSON.parse... is for compatibility with next server actions
      data: { questions: JSON.parse(JSON.stringify(questions)), isNext },
    };
  } catch (error) {
    return handleError(error) as ErrorResponse;
  }
}

export async function incrementViews(
  params: IncrementViewsParams
): Promise<ActionResponse<{ views: number }>> {
  const validationResult = await action({
    params,
    schema: IncrementViewsSchema,
  });

  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  const { questionId } = validationResult.params!;

  try {
    const question = await Question.findById(questionId);

    if (!question) {
      throw new Error("Question not found");
    }
    question.views += 1;

    await question.save();

    revalidatePath(ROUTES.QUESTION(questionId));

    return {
      success: true,
      data: { views: question.views },
    };
  } catch (error) {
    return handleError(error) as ErrorResponse;
  }
}

// NOTE: CHECK mongoose-references.md file

// Server Actions are designed to be used in different contexts:

// 1. In Server Components: They act like regular async functions.
// 2. In Client Components: When used in form actions or event handlers, they are invoked via a POST request.

// It's a Direct Invocation. When you use a Server Action in a Server Component, you're directly calling the function on the server. There's no HTTP request involved at all because both the Server Component and the Server Action are executing in the same server environment.
