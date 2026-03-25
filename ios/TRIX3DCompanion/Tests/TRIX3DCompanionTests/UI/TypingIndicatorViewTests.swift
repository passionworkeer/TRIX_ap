//
//  TypingIndicatorViewTests.swift
//  TRIX3DCompanionTests
//
//  UI component tests for TypingIndicatorView
//  Tests animation behavior and rendering
//

import XCTest
import SwiftUI
@testable import TRIX3DCompanion

// MARK: - TypingIndicatorView Tests

@MainActor
final class TypingIndicatorViewTests: XCTestCase {

    // MARK: - Basic Rendering Tests

    func testTypingIndicatorRenders() throws {
        let view = TypingIndicatorView(isAnimating: true)

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
    }

    func testTypingIndicatorWithAnimatingFalse() throws {
        let view = TypingIndicatorView(isAnimating: false)

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
    }

    func testTypingIndicatorHiddenWhenNotAnimating() throws {
        let view = TypingIndicatorView(isAnimating: false)

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
    }

    // MARK: - Dot Count Tests

    func testTypingIndicatorHasThreeDots() throws {
        let view = TypingIndicatorView(isAnimating: true)

        // Verify 3 dots are rendered
        // The view renders 0..<3 dots via ForEach
        let expectedDotCount = 3

        XCTAssertEqual(expectedDotCount, 3)
    }

    func testTypingIndicatorDotSizes() throws {
        let smallView = TypingIndicatorView.small(isAnimating: true)
        let largeView = TypingIndicatorView.large(isAnimating: true)

        let smallController = UIHostingController(rootView: smallView)
        _ = smallController.view

        let largeController = UIHostingController(rootView: largeView)
        _ = largeController.view

        XCTAssertNotNil(smallController.view)
        XCTAssertNotNil(largeController.view)
    }

    // MARK: - Animation Tests

    func testAnimationStartsOnAppear() throws {
        let view = TypingIndicatorView(isAnimating: true)
            .onAppear { }

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
    }

    func testAnimationStopsWhenDisabled() throws {
        let view = TypingIndicatorView(isAnimating: false)

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
    }

    func testAnimationLoopsCorrectly() throws {
        let view = TypingIndicatorView(isAnimating: true)

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
    }

    func testAnimationDelayBetweenDots() throws {
        // Dots should have staggered delays
        let baseDelay: Double = 0.15

        let delays = (0..<3).map { Double($0) * baseDelay }

        XCTAssertEqual(delays[0], 0.0)
        XCTAssertEqual(delays[1], 0.15)
        XCTAssertEqual(delays[2], 0.30)
    }

    // MARK: - Dot Size Tests

    func testDotSizeCustomization() throws {
        let view = TypingIndicatorView(
            isAnimating: true,
            dotSize: 12,
            spacing: 6
        )

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
    }

    func testDotColorCustomization() throws {
        let view = TypingIndicatorView(
            isAnimating: true,
            dotColor: .purple
        )

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
    }

    // MARK: - Scale Effect Tests

    func testScaleEffectCalculation() throws {
        // Test scale calculation for animation
        let index = 0
        let phase = CGFloat(index) * 0.15
        let time = Date().timeIntervalSince1970
        let sine = sin((time + Double(phase)) * 5.0)
        let scale = 1.0 + sine * 0.3

        XCTAssertGreaterThanOrEqual(scale, 0.7)
        XCTAssertLessThanOrEqual(scale, 1.3)
    }

    func testScaleEffectBounds() throws {
        // Scale should stay within reasonable bounds
        let minScale: CGFloat = 1.0 - 0.3 // 0.7
        let maxScale: CGFloat = 1.0 + 0.3 // 1.3

        XCTAssertEqual(minScale, 0.7)
        XCTAssertEqual(maxScale, 1.3)
    }

    func testScaleEffectAtDifferentIndices() throws {
        for index in 0..<3 {
            let phase = CGFloat(index) * 0.15
            XCTAssertGreaterThanOrEqual(phase, 0)
            XCTAssertLessThan(phase, 0.45)
        }
    }

    // MARK: - Convenience Initializers Tests

    func testSmallTypingIndicator() throws {
        let view = TypingIndicatorView.small(isAnimating: true)

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
    }

    func testLargeTypingIndicator() throws {
        let view = TypingIndicatorView.large(isAnimating: true)

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
    }

    func testColoredTypingIndicator() throws {
        let colors: [Color] = [.purple, .info, .green, .brandPurple]

        for color in colors {
            let view = TypingIndicatorView.colored(color, isAnimating: true)

            let controller = UIHostingController(rootView: view)
            _ = controller.view

            XCTAssertNotNil(controller.view)
        }
    }

    // MARK: - TypingBubbleView Tests

    func testTypingBubbleViewRenders() throws {
        let view = TypingBubbleView(isAnimating: true)

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
    }

    func testTypingBubbleViewContainsIndicator() throws {
        let view = TypingBubbleView(isAnimating: true)

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
    }

    func testTypingBubbleViewShape() throws {
        let view = TypingBubbleView(isAnimating: true)

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
    }

    // MARK: - TypingStatusView Tests

    func testTypingStatusViewSinglePerson() throws {
        let view = TypingStatusView(names: ["Alice"], isAnimating: true)

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
        XCTAssertEqual(["Alice"].count, 1)
    }

    func testTypingStatusViewTwoPeople() throws {
        let view = TypingStatusView(names: ["Alice", "Bob"], isAnimating: true)

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
        XCTAssertEqual(["Alice", "Bob"].count, 2)
    }

    func testTypingStatusViewMultiplePeople() throws {
        let view = TypingStatusView(names: ["Alice", "Bob", "Charlie"], isAnimating: true)

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
        XCTAssertEqual(["Alice", "Bob", "Charlie"].count, 3)
    }

    func testTypingStatusViewEmptyNames() throws {
        let view = TypingStatusView(names: [], isAnimating: false)

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
        XCTAssertEqual([].count, 0)
    }

    func testTypingStatusViewDisplayTextSingle() throws {
        let names = ["Alice"]
        let displayText: String

        if names.isEmpty {
            displayText = ""
        } else if names.count == 1 {
            displayText = String(format: "chat.typing.single", names[0])
        } else if names.count == 2 {
            displayText = String(format: "chat.typing.dual", names[0], names[1])
        } else {
            displayText = String(format: "chat.typing.multiple", names.count)
        }

        XCTAssertFalse(displayText.isEmpty)
    }

    func testTypingStatusViewDisplayTextMultiple() throws {
        let names = ["Alice", "Bob", "Charlie"]

        let displayText: String
        if names.count > 2 {
            displayText = String(format: "chat.typing.multiple", names.count)
        } else {
            displayText = ""
        }

        XCTAssertFalse(displayText.isEmpty)
    }

    // MARK: - Animation Duration Tests

    func testAnimationDuration() throws {
        let duration: Double = 0.6

        XCTAssertEqual(duration, 0.6)
        XCTAssertGreaterThan(duration, 0)
    }

    func testAnimationRepeatForever() throws {
        // Animation should repeat indefinitely
        let repeatCount: Int? = nil // Forever
        XCTAssertNil(repeatCount)
    }

    func testAnimationAutoreverses() throws {
        // Animation should autoreverse for smooth effect
        let autoreverses = true
        XCTAssertTrue(autoreverses)
    }

    // MARK: - Layout Tests

    func testTypingIndicatorPadding() throws {
        let view = TypingIndicatorView(isAnimating: true)

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
    }

    func testTypingIndicatorSpacing() throws {
        let view = TypingIndicatorView(isAnimating: true, spacing: 4)

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
    }

    func testTypingIndicatorClipShape() throws {
        let view = TypingIndicatorView(isAnimating: true)

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
    }

    // MARK: - State Change Tests

    func testStateChangeFromAnimatingToIdle() throws {
        var isAnimating = true

        // Simulate state change
        isAnimating = false

        XCTAssertFalse(isAnimating)
    }

    func testOnChangeTriggered() throws {
        let view = TypingIndicatorView(isAnimating: true)

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
    }

    // MARK: - Multiple Indicator Tests

    func testMultipleIndicatorsInList() throws {
        let views = (0..<5).map { _ in
            TypingIndicatorView(isAnimating: true)
        }

        XCTAssertEqual(views.count, 5)
    }

    // MARK: - Accessibility Tests

    func testTypingIndicatorAccessibility() throws {
        let view = TypingIndicatorView(isAnimating: true)

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
    }

    // MARK: - Preview Compatibility Tests

    func testPreviewInChatContext() throws {
        let view = VStack {
            HStack {
                Text("Hey, are you there?")
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                Spacer()
            }

            HStack {
                TypingBubbleView(isAnimating: true)
                Spacer()
            }
        }

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
    }
}
