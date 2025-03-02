"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MDXEditorMethods } from "@mdxeditor/editor";
import { ReloadIcon } from "@radix-ui/react-icons";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "@/hooks/use-toast";
import { createAnswer } from "@/lib/actions/answer.action";
import { api } from "@/lib/api";
import { AnswerSchema } from "@/lib/validations";

// Dynamically import the Editor component to prevent server-side rendering issues with MDXEditor
const Editor = dynamic(() => import("@/components/editor"), {
  ssr: false,
});

interface Props {
  questionId: string;
  questionTitle: string;
  questionContent: string;
}

// AnswerForm component handles user input for submitting an answer to a question
const AnswerForm = ({ questionId, questionTitle, questionContent }: Props) => {
  // useTransition manages the pending state of asynchronous operations for smoother UI updates
  const [isAnswering, startAnsweringTransition] = useTransition();

  // useState tracks the loading state of the AI-generated answer feature
  const [isAISubmitting, setIsAISubmitting] = useState(false);

  // useSession retrieves the user's authentication status from NextAuth
  const session = useSession();

  // useRef creates a reference to the MDXEditor instance for programmatic control
  const editorRef = useRef<MDXEditorMethods>(null);

  // useForm initializes the form with Zod validation via zodResolver and default values
  // - resolver: Integrates Zod schema (AnswerSchema) for type-safe validation
  // - defaultValues: Sets the initial value of the "content" field to an empty string
  const form = useForm<z.infer<typeof AnswerSchema>>({
    resolver: zodResolver(AnswerSchema),
    defaultValues: {
      content: "",
    },
  });

  // handleSubmit processes the form submission asynchronously
  // - Uses startAnsweringTransition to wrap the async operation, improving UX during loading
  const handleSubmit = async (values: z.infer<typeof AnswerSchema>) => {
    startAnsweringTransition(async () => {
      const result = await createAnswer({
        questionId,
        content: values.content,
      });

      if (result.success) {
        // Reset the form fields to their default values after successful submission
        form.reset();

        toast({
          title: "Success",
          description: "Your answer has been posted successfully",
        });

        // Clear the editor content programmatically if the ref exists
        if (editorRef.current) {
          editorRef.current.setMarkdown("");
        }
      } else {
        toast({
          title: "Error",
          description: result.error?.message,
          variant: "destructive",
        });
      }
    });
  };

  // generateAIAnswer fetches an AI-generated answer and updates the form
  const generateAIAnswer = async () => {
    // Check if the user is authenticated before proceeding
    if (session.status !== "authenticated") {
      return toast({
        title: "Please log in",
        description: "You need to be logged in to use this feature",
      });
    }

    setIsAISubmitting(true);

    try {
      // Call the API to generate an AI answer based on the question title and content
      const { success, data, error } = await api.ai.getAnswer(
        questionTitle,
        questionContent
      );

      if (!success) {
        return toast({
          title: "Error",
          description: error?.message,
          variant: "destructive",
        });
      }

      // Format the AI response by replacing <br> tags with spaces and trimming
      const formattedAnswer = data.replace(/<br>/g, " ").toString().trim();

      if (editorRef.current) {
        // Update the editor content with the AI-generated answer
        editorRef.current.setMarkdown(formattedAnswer);

        // Programmatically set the form's "content" field value using setValue
        // - setValue updates the field without requiring manual input
        form.setValue("content", formattedAnswer);

        // Trigger validation for the "content" field to ensure it meets schema rules
        form.trigger("content");
      }

      toast({
        title: "Success",
        description: "AI generated answer has been generated",
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "There was a problem with your request",
        variant: "destructive",
      });
    } finally {
      // Reset the AI submitting state regardless of success or failure
      setIsAISubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center sm:gap-2">
        <h4 className="paragraph-semibold text-dark400_light800">
          Write your answer here
        </h4>
        <Button
          className="btn light-border-2 gap-1.5 rounded-md border px-4 py-2.5 text-primary-500 shadow-none dark:text-primary-500"
          disabled={isAISubmitting}
          onClick={generateAIAnswer}
        >
          {isAISubmitting ? (
            <>
              <ReloadIcon className="mr-2 size-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Image
                src="/icons/stars.svg"
                alt="Generate AI Answer"
                width={12}
                height={12}
                className="object-contain"
              />
              Generate AI Answer
            </>
          )}
        </Button>
      </div>

      {/* Form component from react-hook-form integrates with the form instance */}
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmit)} // handleSubmit wraps the custom submission logic
          className="mt-6 flex w-full flex-col gap-10"
        >
          {/* FormField renders a controlled field connected to the form */}
          <FormField
            control={form.control} // Provides access to form state and methods
            name="content" // Field name matching the schema
            render={({ field }) => (
              <FormItem className="flex w-full flex-col gap-3">
                <FormControl className="mt-3.5">
                  {/* Editor component is a custom wrapper around MDXEditor */}
                  <Editor
                    value={field.value} // Controlled value from the form
                    editorRef={editorRef} // Ref for programmatic control
                    fieldChange={field.onChange} // Updates form state on user input
                  />
                </FormControl>
                {/* FormMessage displays validation errors if they exist */}
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end">
            <Button type="submit" className="primary-gradient w-fit">
              {isAnswering ? (
                <>
                  <ReloadIcon className="mr-2 size-4 animate-spin" />
                  Posting...
                </>
              ) : (
                "Post Answer"
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default AnswerForm;
