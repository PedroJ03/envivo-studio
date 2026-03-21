/**
 * TopicCard Component Tests
 *
 * Tests for the TopicCard component that displays pending topics.
 *
 * @module topics/__tests__/topic-card.test
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TopicCard } from "../components/topic-card";
import type { PendingTopic } from "@/lib/topics/types";

const mockTopic: PendingTopic = {
  id: "123e4567-e89b-12d3-a456-426614174000",
  sourceType: "calendar_event",
  source: "ticketmaster",
  title: "Oasis en River",
  description: "Concierto en el Estadio River Plate",
  date: "2026-03-25T21:00:00.000Z",
  type: "concert",
  priority: 3,
  image: "https://example.com/oasis.jpg",
  tags: ["rock", "concierto", "internacional"],
  isShared: false,
};

describe("TopicCard", () => {
  describe("Rendering", () => {
    it("renders topic title", () => {
      render(
        <TopicCard
          topic={mockTopic}
          isSelected={false}
          onSelect={vi.fn()}
          onDiscard={vi.fn()}
          onToggleSelect={vi.fn()}
        />,
      );

      expect(screen.getByText("Oasis en River")).toBeInTheDocument();
    });

    it("renders topic description", () => {
      render(
        <TopicCard
          topic={mockTopic}
          isSelected={false}
          onSelect={vi.fn()}
          onDiscard={vi.fn()}
          onToggleSelect={vi.fn()}
        />,
      );

      expect(
        screen.getByText("Concierto en el Estadio River Plate"),
      ).toBeInTheDocument();
    });

    it("renders source badge", () => {
      render(
        <TopicCard
          topic={mockTopic}
          isSelected={false}
          onSelect={vi.fn()}
          onDiscard={vi.fn()}
          onToggleSelect={vi.fn()}
        />,
      );

      expect(screen.getByText("ticketmaster")).toBeInTheDocument();
    });

    it("renders type badge for calendar event", () => {
      render(
        <TopicCard
          topic={mockTopic}
          isSelected={false}
          onSelect={vi.fn()}
          onDiscard={vi.fn()}
          onToggleSelect={vi.fn()}
        />,
      );

      expect(screen.getByText("Evento")).toBeInTheDocument();
    });

    it("renders type badge for content feed item", () => {
      const feedTopic: PendingTopic = {
        ...mockTopic,
        sourceType: "content_feed_item",
      };

      render(
        <TopicCard
          topic={feedTopic}
          isSelected={false}
          onSelect={vi.fn()}
          onDiscard={vi.fn()}
          onToggleSelect={vi.fn()}
        />,
      );

      expect(screen.getByText("Feed")).toBeInTheDocument();
    });

    it("renders priority badge", () => {
      render(
        <TopicCard
          topic={mockTopic}
          isSelected={false}
          onSelect={vi.fn()}
          onDiscard={vi.fn()}
          onToggleSelect={vi.fn()}
        />,
      );

      // Priority 3 should show "Alta"
      expect(screen.getByText("Alta")).toBeInTheDocument();
    });

    it("renders shared badge when topic is shared", () => {
      const sharedTopic: PendingTopic = {
        ...mockTopic,
        isShared: true,
      };

      render(
        <TopicCard
          topic={sharedTopic}
          isSelected={false}
          onSelect={vi.fn()}
          onDiscard={vi.fn()}
          onToggleSelect={vi.fn()}
        />,
      );

      expect(screen.getByText("Compartido")).toBeInTheDocument();
    });

    it("does not render shared badge when topic is not shared", () => {
      render(
        <TopicCard
          topic={mockTopic}
          isSelected={false}
          onSelect={vi.fn()}
          onDiscard={vi.fn()}
          onToggleSelect={vi.fn()}
        />,
      );

      expect(screen.queryByText("Compartido")).not.toBeInTheDocument();
    });

    it("renders tags", () => {
      render(
        <TopicCard
          topic={mockTopic}
          isSelected={false}
          onSelect={vi.fn()}
          onDiscard={vi.fn()}
          onToggleSelect={vi.fn()}
        />,
      );

      expect(screen.getByText("rock")).toBeInTheDocument();
      expect(screen.getByText("concierto")).toBeInTheDocument();
    });

    it("renders image when provided", () => {
      render(
        <TopicCard
          topic={mockTopic}
          isSelected={false}
          onSelect={vi.fn()}
          onDiscard={vi.fn()}
          onToggleSelect={vi.fn()}
        />,
      );

      const img = screen.getByRole("img");
      expect(img).toHaveAttribute("src", "https://example.com/oasis.jpg");
    });

    it("renders placeholder when no image", () => {
      const topicWithoutImage: PendingTopic = {
        ...mockTopic,
        image: undefined,
      };

      render(
        <TopicCard
          topic={topicWithoutImage}
          isSelected={false}
          onSelect={vi.fn()}
          onDiscard={vi.fn()}
          onToggleSelect={vi.fn()}
        />,
      );

      // Should not have an img role when no image
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("calls onSelect when Select button is clicked", () => {
      const onSelect = vi.fn();

      render(
        <TopicCard
          topic={mockTopic}
          isSelected={false}
          onSelect={onSelect}
          onDiscard={vi.fn()}
          onToggleSelect={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByText("Seleccionar"));
      expect(onSelect).toHaveBeenCalledWith(mockTopic);
    });

    it("calls onDiscard when Discard button is clicked", () => {
      const onDiscard = vi.fn();

      render(
        <TopicCard
          topic={mockTopic}
          isSelected={false}
          onSelect={vi.fn()}
          onDiscard={onDiscard}
          onToggleSelect={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByText("Descartar"));
      expect(onDiscard).toHaveBeenCalledWith(mockTopic);
    });

    it("calls onToggleSelect when checkbox is clicked", () => {
      const onToggleSelect = vi.fn();

      render(
        <TopicCard
          topic={mockTopic}
          isSelected={false}
          onSelect={vi.fn()}
          onDiscard={vi.fn()}
          onToggleSelect={onToggleSelect}
        />,
      );

      const checkbox = screen.getByRole("checkbox");
      fireEvent.click(checkbox);
      expect(onToggleSelect).toHaveBeenCalledWith(mockTopic.id);
    });
  });

  describe("Selection State", () => {
    it("applies selected styling when isSelected is true", () => {
      render(
        <TopicCard
          topic={mockTopic}
          isSelected={true}
          onSelect={vi.fn()}
          onDiscard={vi.fn()}
          onToggleSelect={vi.fn()}
        />,
      );

      const article = screen.getByRole("article");
      expect(article).toHaveClass("border-indigo-500");
    });

    it("applies default styling when isSelected is false", () => {
      render(
        <TopicCard
          topic={mockTopic}
          isSelected={false}
          onSelect={vi.fn()}
          onDiscard={vi.fn()}
          onToggleSelect={vi.fn()}
        />,
      );

      const article = screen.getByRole("article");
      expect(article).toHaveClass("border-slate-800");
    });

    it("checkbox is checked when isSelected is true", () => {
      render(
        <TopicCard
          topic={mockTopic}
          isSelected={true}
          onSelect={vi.fn()}
          onDiscard={vi.fn()}
          onToggleSelect={vi.fn()}
        />,
      );

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toBeChecked();
    });

    it("checkbox is unchecked when isSelected is false", () => {
      render(
        <TopicCard
          topic={mockTopic}
          isSelected={false}
          onSelect={vi.fn()}
          onDiscard={vi.fn()}
          onToggleSelect={vi.fn()}
        />,
      );

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).not.toBeChecked();
    });
  });

  describe("Edge Cases", () => {
    it("handles topic without description", () => {
      const topicWithoutDesc: PendingTopic = {
        ...mockTopic,
        description: undefined,
      };

      render(
        <TopicCard
          topic={topicWithoutDesc}
          isSelected={false}
          onSelect={vi.fn()}
          onDiscard={vi.fn()}
          onToggleSelect={vi.fn()}
        />,
      );

      // Should still render title
      expect(screen.getByText("Oasis en River")).toBeInTheDocument();
    });

    it("handles topic without tags", () => {
      const topicWithoutTags: PendingTopic = {
        ...mockTopic,
        tags: [],
      };

      render(
        <TopicCard
          topic={topicWithoutTags}
          isSelected={false}
          onSelect={vi.fn()}
          onDiscard={vi.fn()}
          onToggleSelect={vi.fn()}
        />,
      );

      // Should still render title and description
      expect(screen.getByText("Oasis en River")).toBeInTheDocument();
    });

    it("limits visible tags to 3 with overflow indicator", () => {
      const topicWithManyTags: PendingTopic = {
        ...mockTopic,
        tags: ["tag1", "tag2", "tag3", "tag4", "tag5"],
      };

      render(
        <TopicCard
          topic={topicWithManyTags}
          isSelected={false}
          onSelect={vi.fn()}
          onDiscard={vi.fn()}
          onToggleSelect={vi.fn()}
        />,
      );

      // Should show first 3 tags
      expect(screen.getByText("tag1")).toBeInTheDocument();
      expect(screen.getByText("tag2")).toBeInTheDocument();
      expect(screen.getByText("tag3")).toBeInTheDocument();

      // Should show +2 indicator
      expect(screen.getByText("+2")).toBeInTheDocument();
    });
  });
});
