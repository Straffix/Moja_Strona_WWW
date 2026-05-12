'use strict'

document.addEventListener('DOMContentLoaded', () => {
	document.documentElement.classList.add('has-js')

	initSiteFooter()
	initTaglineRotator()
	initSiteIntro()
	enhanceProjectMockups()
	initProjectSliders()
	initExpandingPanels()
	initPanelScrollNavigation()
	initStackPanelHoverTrail()
	initPortfolioScrollReveal()
	initContactPanel()
	initThemeSwitcher()

	const backgroundScene = document.querySelector('[data-background-scene]')
	if (!backgroundScene) {
		return
	}

	if (typeof window.renderBackgroundScene === 'function') {
		window.renderBackgroundScene(backgroundScene)
	}

	initNetworkCanvas(backgroundScene)
})

function initSiteFooter() {
	const yearTargets = document.querySelectorAll('[data-current-year]')
	if (!yearTargets.length) {
		return
	}

	const currentYear = String(new Date().getFullYear())

	for (const target of yearTargets) {
		target.textContent = currentYear
	}
}

function enhanceProjectMockups(root = document) {
	const screens = root.querySelectorAll('.project-demo__frame--top .project-demo__screen, .project-demo__frame--bottom .project-demo__screen')

	for (const screen of screens) {
		const frame = screen.closest('.project-demo__frame')
		const isPortfolioPhone = Boolean(frame?.classList.contains('project-demo__frame--bottom') && frame.closest('.portfolio-mock'))

		for (const backdrop of screen.querySelectorAll('.project-demo__image--backdrop')) {
			backdrop.remove()
		}

		const image = screen.querySelector('.project-demo__image')
		if (!image) {
			continue
		}

		if (isPortfolioPhone) {
			const backdrop = image.cloneNode()
			backdrop.className = 'project-demo__image project-demo__image--backdrop'
			backdrop.alt = ''
			backdrop.setAttribute('aria-hidden', 'true')
			screen.insertBefore(backdrop, image)
		}

		image.classList.add('project-demo__image--foreground')
	}
}

function initTaglineRotator() {
	const tagline = document.querySelector('[data-tagline-rotator]')
	const taglineText = tagline ? tagline.querySelector('[data-tagline-text]') : null

	if (!tagline || !taglineText) {
		return
	}

	const phrases = String(tagline.dataset.taglinePhrases || '')
		.split('|')
		.map(phrase => phrase.trim())
		.filter(Boolean)

	if (!phrases.length) {
		return
	}

	const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
	let phraseIndex = 0
	let charIndex = 0
	let isDeleting = false
	let timerId = 0
	let started = false
	let introObserver = null

	const writeDelay = 50
	const deleteDelay = 18
	const phrasePause = 2500
	const resetPause = 120

	const setPhrase = value => {
		taglineText.textContent = value
		tagline.setAttribute('aria-label', value)
	}

	const clearTimer = () => {
		if (timerId) {
			window.clearTimeout(timerId)
			timerId = 0
		}
	}

	const renderStaticPhrase = () => {
		clearTimer()
		if (introObserver) {
			introObserver.disconnect()
			introObserver = null
		}

		started = false
		phraseIndex = 0
		charIndex = 0
		isDeleting = false
		setPhrase(phrases[0])
	}

	const step = () => {
		const currentPhrase = phrases[phraseIndex]

		if (!isDeleting) {
			charIndex += 1
			setPhrase(currentPhrase.slice(0, charIndex))

			if (charIndex >= currentPhrase.length) {
				isDeleting = true
				timerId = window.setTimeout(step, phrasePause)
				return
			}

			timerId = window.setTimeout(step, writeDelay)
			return
		}

		charIndex -= 1
		setPhrase(currentPhrase.slice(0, Math.max(charIndex, 0)))

		if (charIndex <= 0) {
			isDeleting = false
			phraseIndex = (phraseIndex + 1) % phrases.length
			timerId = window.setTimeout(step, resetPause)
			return
		}

		timerId = window.setTimeout(step, deleteDelay)
	}

	const start = () => {
		if (started || reduceMotionQuery.matches) {
			return
		}

		started = true
		clearTimer()
		setPhrase('')
		phraseIndex = 0
		charIndex = 0
		isDeleting = false
		timerId = window.setTimeout(step, 260)
	}

	const startWhenIntroIsDone = () => {
		if (reduceMotionQuery.matches) {
			renderStaticPhrase()
			return true
		}

		if (document.documentElement.classList.contains('intro-complete')) {
			start()
			return true
		}

		return false
	}

	if (!startWhenIntroIsDone()) {
		introObserver = new MutationObserver(() => {
			if (startWhenIntroIsDone() && introObserver) {
				introObserver.disconnect()
				introObserver = null
			}
		})

		introObserver.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['class'],
		})
	}

	addMediaQueryListener(reduceMotionQuery, () => {
		if (reduceMotionQuery.matches) {
			renderStaticPhrase()
			return
		}

		if (document.documentElement.classList.contains('intro-complete')) {
			start()
		}
	})
}

function initSiteIntro() {
	const intro = document.querySelector('[data-site-intro]')
	const introBrand = intro ? intro.querySelector('[data-site-intro-brand]') : null
	const targetBrand = document.querySelector('.brand')

	if (!intro || !introBrand || !targetBrand) {
		document.documentElement.classList.add('intro-complete')
		return
	}

	const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
	let isFinished = false
	let fallbackTimerId = 0
	let resizeTimerId = 0
	let startQueued = false
	let introFlightTransform = 'translate3d(0, 0, 0) scale(1)'

	const finishIntro = () => {
		if (isFinished) {
			return
		}

		isFinished = true
		window.clearTimeout(fallbackTimerId)
		window.clearTimeout(resizeTimerId)
		window.removeEventListener('resize', scheduleMotionSync)
		intro.classList.remove('is-flying')
		intro.classList.remove('is-ready')
		document.documentElement.classList.add('intro-complete')
		intro.classList.add('is-done')

		window.setTimeout(() => {
			intro.setAttribute('hidden', '')
		}, 280)
	}

	if (reduceMotionQuery.matches) {
		finishIntro()
		return
	}

	const syncIntroMotion = () => {
		const introRect = introBrand.getBoundingClientRect()
		const targetRect = targetBrand.getBoundingClientRect()
		const scale = targetRect.width / Math.max(introRect.width, 1)
		const translateX = targetRect.left + targetRect.width / 2 - (introRect.left + introRect.width / 2)
		const translateY = targetRect.top + targetRect.height / 2 - (introRect.top + introRect.height / 2)

		introFlightTransform = `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`
	}

	function scheduleMotionSync() {
		if (intro.classList.contains('is-flying')) {
			return
		}

		window.clearTimeout(resizeTimerId)
		resizeTimerId = window.setTimeout(syncIntroMotion, 120)
	}

	const queueIntroStart = () => {
		if (startQueued || isFinished) {
			return
		}

		startQueued = true
		window.requestAnimationFrame(startIntro)
	}

	const startIntro = () => {
		if (isFinished) {
			return
		}

		syncIntroMotion()
		intro.classList.add('is-ready')

		window.setTimeout(() => {
			if (isFinished) {
				return
			}

			syncIntroMotion()
			intro.classList.add('is-flying')
			introBrand.style.transform = introFlightTransform
			fallbackTimerId = window.setTimeout(finishIntro, 900)
		}, 850)
	}

	introBrand.addEventListener('transitionend', event => {
		if (event.propertyName === 'transform' && intro.classList.contains('is-flying')) {
			finishIntro()
		}
	})
	window.addEventListener('resize', scheduleMotionSync)

	if (document.fonts && typeof document.fonts.ready === 'object') {
		document.fonts.ready
			.then(() => {
				if (!isFinished && !intro.classList.contains('is-flying')) {
					syncIntroMotion()
				}
			})
			.catch(() => {})
	}

	if (document.fonts && typeof document.fonts.ready === 'object') {
		Promise.race([
			document.fonts.ready.catch(() => undefined),
			new Promise(resolve => window.setTimeout(resolve, 700)),
		]).then(() => {
			queueIntroStart()
		})
	} else {
		queueIntroStart()
	}
}

function initProjectSliders() {
	const sliders = document.querySelectorAll('[data-project-slider]')
	for (const slider of sliders) {
		initProjectSlider(slider)
	}
}

function initProjectSlider(slider) {
	const slides = Array.from(slider.querySelectorAll('[data-project-slide]'))
	const prevButton = slider.querySelector('[data-project-prev]')
	const nextButton = slider.querySelector('[data-project-next]')
	const toggleButton = slider.querySelector('[data-project-toggle]')
	if (slides.length < 2) {
		return
	}

	const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
	const interval = Number(slider.dataset.sliderInterval) || 3200
	const preloadDelay = Math.max(interval - 1200, 1000)
	let activeIndex = Math.max(
		slides.findIndex(slide => slide.classList.contains('is-active')),
		0,
	)
	let timerId = 0
	let preloadTimerId = 0
	let isUserPaused = false

	const clearRotationTimer = () => {
		if (timerId) {
			window.clearInterval(timerId)
			timerId = 0
		}
	}

	const clearPreloadTimer = () => {
		if (preloadTimerId) {
			window.clearTimeout(preloadTimerId)
			preloadTimerId = 0
		}
	}

	const syncControlsState = () => {
		slider.classList.toggle('is-user-paused', isUserPaused)

		if (!toggleButton) {
			return
		}

		toggleButton.disabled = reduceMotionQuery.matches
		toggleButton.setAttribute('aria-pressed', isUserPaused ? 'true' : 'false')

		if (reduceMotionQuery.matches) {
			toggleButton.setAttribute('aria-label', 'Automatyczne przewijanie wyłączone przez ustawienia ograniczenia ruchu')
			return
		}

		toggleButton.setAttribute(
			'aria-label',
			isUserPaused ? 'Wznów automatyczne przewijanie projektów' : 'Wstrzymaj automatyczne przewijanie projektów',
		)
	}

	const loadSlideMedia = slide => {
		const lazyImages = slide.querySelectorAll('img[data-src]')

		for (const image of lazyImages) {
			image.src = image.dataset.src
			image.removeAttribute('data-src')
		}
	}

	const preloadNextSlide = () => {
		clearPreloadTimer()
		if (reduceMotionQuery.matches) {
			return
		}

		preloadTimerId = window.setTimeout(() => {
			loadSlideMedia(slides[(activeIndex + 1) % slides.length])
		}, preloadDelay)
	}

	const showSlide = nextIndex => {
		slides[activeIndex].classList.remove('is-active')
		slides[activeIndex].setAttribute('aria-hidden', 'true')
		slides[activeIndex].setAttribute('tabindex', '-1')

		activeIndex = (nextIndex + slides.length) % slides.length
		const activeSlide = slides[activeIndex]

		loadSlideMedia(activeSlide)
		activeSlide.classList.add('is-active')
		activeSlide.removeAttribute('aria-hidden')
		activeSlide.removeAttribute('tabindex')
		preloadNextSlide()
	}

	const pause = () => {
		clearRotationTimer()
		clearPreloadTimer()
		slider.classList.add('is-paused')
	}

	const start = () => {
		if (timerId || reduceMotionQuery.matches || isUserPaused) {
			slider.classList.add('is-paused')
			return
		}

		slider.classList.remove('is-paused')
		timerId = window.setInterval(() => showSlide(activeIndex + 1), interval)
		preloadNextSlide()
	}

	const clearPointerFocus = () => {
		if (isUserPaused) {
			return
		}

		const activeElement = document.activeElement
		if (!(activeElement instanceof HTMLElement) || !slider.contains(activeElement)) {
			return
		}

		if (activeElement.matches(':focus-visible')) {
			return
		}

		activeElement.blur()
	}

	const goToSlide = nextIndex => {
		pause()
		showSlide(nextIndex)
	}

	const togglePlayback = () => {
		isUserPaused = !isUserPaused
		syncControlsState()

		if (isUserPaused) {
			pause()
			return
		}

		start()
	}

	slider.addEventListener('mouseenter', pause)
	slider.addEventListener('mouseleave', () => {
		clearPointerFocus()
		start()
	})
	slider.addEventListener('focusin', pause)
	slider.addEventListener('focusout', event => {
		const nextFocused = event.relatedTarget
		if (nextFocused instanceof Node && slider.contains(nextFocused)) {
			return
		}

		start()
	})

	if (prevButton) {
		prevButton.addEventListener('click', event => {
			event.preventDefault()
			event.stopPropagation()
			goToSlide(activeIndex - 1)
		})
	}

	if (nextButton) {
		nextButton.addEventListener('click', event => {
			event.preventDefault()
			event.stopPropagation()
			goToSlide(activeIndex + 1)
		})
	}

	if (toggleButton) {
		toggleButton.addEventListener('click', event => {
			event.preventDefault()
			event.stopPropagation()
			togglePlayback()
		})
	}

	addMediaQueryListener(reduceMotionQuery, () => {
		syncControlsState()
		if (reduceMotionQuery.matches) {
			pause()
			return
		}
		start()
	})

	showSlide(activeIndex)
	syncControlsState()
	if (reduceMotionQuery.matches) {
		pause()
		return
	}
	start()
}

function initExpandingPanels() {
	const triggers = document.querySelectorAll('[data-expand-trigger]')
	const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
	const focusableSelector =
		'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
	const panelHistoryStateKey = 'tilePanelId'
	const panelHistoryStateMarker = 'lisieckidev-tile-panel'

	const getHistoryPanelId = state => {
		if (!state || typeof state !== 'object') {
			return null
		}

		return state.__tilePanelMarker === panelHistoryStateMarker ? state[panelHistoryStateKey] || null : null
	}

	const createPanelHistoryState = panelId => ({
		__tilePanelMarker: panelHistoryStateMarker,
		[panelHistoryStateKey]: panelId,
	})

	for (const trigger of triggers) {
		const panelId = trigger.dataset.expandTarget
		const panel = panelId ? document.getElementById(panelId) : null
		const closeButton = panel ? panel.querySelector('[data-expand-close]') : null

		if (!panel || !closeButton) {
			continue
		}

		initExpandingPanel(trigger, panel, closeButton, reduceMotionQuery, focusableSelector, {
			getHistoryPanelId,
			createPanelHistoryState,
		})
	}
}

function registerPanelReveal(target, { group = 0, phase = 0, type = '' } = {}) {
	if (!target) {
		return
	}

	target.setAttribute('data-panel-reveal', '')

	if (type) {
		target.dataset.panelRevealType = type
	}

	target.dataset.panelRevealGroup = String(group)
	target.dataset.panelRevealPhase = String(phase)
}

function setupPanelReveal(panel) {
	if (!panel || panel.dataset.panelRevealReady === 'true') {
		return
	}

	const getRevealTiming = () => {
		switch (panel.id) {
			case 'portfolio-panel':
				return { baseDelay: 560, groupStep: 78, phaseStep: 58 }
			case 'about-panel':
				return { baseDelay: 560, groupStep: 86, phaseStep: 60 }
			case 'contact-panel':
				return { baseDelay: 560, groupStep: 88, phaseStep: 60 }
			case 'stack-panel':
				return { baseDelay: 520, groupStep: 56, phaseStep: 42 }
			default:
				return { baseDelay: 560, groupStep: 92, phaseStep: 64 }
		}
	}

	const syncRevealDelays = isOpen => {
		const { baseDelay, groupStep, phaseStep } = getRevealTiming()

		for (const item of panel.querySelectorAll('[data-panel-reveal]')) {
			if (!(item instanceof HTMLElement)) {
				continue
			}

			if (!isOpen) {
				item.style.transitionDelay = '0s, 0s, 0s'
				continue
			}

			const group = Number.parseFloat(item.dataset.panelRevealGroup || '0')
			const phase = Number.parseFloat(item.dataset.panelRevealPhase || '0')
			const delay = Math.max(Math.round(baseDelay + group * groupStep + phase * phaseStep), 0)
			const delayValue = `${delay}ms`

			item.style.transitionDelay = `${delayValue}, ${delayValue}, ${delayValue}`
		}
	}

	if (panel.id === 'portfolio-panel') {
		registerPanelReveal(panel.querySelector('.portfolio-panel__header'))

		panel.querySelectorAll('.portfolio-work').forEach((work, index) => {
			const group = 1 + index * 0.82
			registerPanelReveal(work.querySelector('.portfolio-work__meta'), { group, phase: 0 })
			registerPanelReveal(work.querySelector('.portfolio-work__copy h3'), { group, phase: 1 })
			registerPanelReveal(work.querySelector('.portfolio-work__copy > p:not(.portfolio-work__meta)'), {
				group,
				phase: 2,
			})
			registerPanelReveal(work.querySelector('.portfolio-work__tags'), {
				group,
				phase: 3,
				type: 'tag-list',
			})
			registerPanelReveal(work.querySelector('.portfolio-work__link'), { group, phase: 4, type: 'cta' })
			registerPanelReveal(work.querySelector('.portfolio-work__media'), { group, phase: 5, type: 'media' })
		})
	}

	if (panel.id === 'about-panel') {
		registerPanelReveal(panel.querySelector('.about-panel__header'))

		const heroCopy = panel.querySelector('.about-hero__copy')
		registerPanelReveal(heroCopy?.querySelector('.about-kicker'), { group: 1, phase: 0 })
		registerPanelReveal(heroCopy?.querySelector('h3'), { group: 1, phase: 1 })
		registerPanelReveal(heroCopy?.querySelector('p:not(.about-kicker)'), { group: 1, phase: 2 })
		registerPanelReveal(heroCopy?.querySelector('.about-tags'), { group: 1, phase: 3, type: 'tag-list' })
		registerPanelReveal(panel.querySelector('.about-portrait'), { group: 1, phase: 4, type: 'media' })

		panel.querySelectorAll('.about-story .about-card').forEach((card, index) => {
			registerPanelReveal(card, { group: 2 + index * 0.72, type: 'card' })
		})

		const hobbyIntro = panel.querySelector('.about-hobby__intro')
		registerPanelReveal(hobbyIntro?.querySelector('.about-card__meta'), { group: 4.5, phase: 0 })
		registerPanelReveal(hobbyIntro?.querySelector('h3'), { group: 4.5, phase: 1 })
		registerPanelReveal(hobbyIntro?.querySelector('p:not(.about-card__meta)'), { group: 4.5, phase: 2 })
		registerPanelReveal(hobbyIntro?.querySelector('.about-hobby__intro-icon'), {
			group: 4.5,
			phase: 3,
			type: 'media',
		})

		panel.querySelectorAll('.about-hobby__grid .about-hobby__item').forEach((item, index) => {
			registerPanelReveal(item, { group: 5.6 + index * 0.48, type: 'card' })
		})
	}

	if (panel.id === 'contact-panel') {
		registerPanelReveal(panel.querySelector('.tile-panel__contact-header'))
		registerPanelReveal(panel.querySelector('.contact-back'), { group: 1, type: 'card' })
		registerPanelReveal(panel.querySelector('.contact-back__cards'), { group: 1, phase: 1 })
		registerPanelReveal(panel.querySelector('.contact-back__socials'), { group: 1, phase: 2 })
		registerPanelReveal(panel.querySelector('.contact-form'), { group: 2, type: 'card' })
		registerPanelReveal(panel.querySelector('.contact-form__row'), { group: 2, phase: 1 })
		registerPanelReveal(panel.querySelector('.contact-form__row + .contact-form__field'), {
			group: 2,
			phase: 2,
		})
		registerPanelReveal(panel.querySelector('.contact-form__field--message'), { group: 2, phase: 3 })
		registerPanelReveal(panel.querySelector('.contact-form__file'), { group: 2, phase: 4 })
		registerPanelReveal(panel.querySelector('.contact-check'), { group: 2, phase: 5 })
		registerPanelReveal(panel.querySelector('.contact-form__actions'), { group: 2, phase: 6, type: 'cta' })
	}

	if (panel.id === 'stack-panel') {
		registerPanelReveal(panel.querySelector('.stack-panel__header'))

		panel.querySelectorAll('.stack-panel__matrix > *').forEach((item, index) => {
			const type = item.classList.contains('stack-panel__item') ? 'card' : ''
			registerPanelReveal(item, { group: 1 + index * 0.18, type })
		})
	}

	panel.addEventListener('tilepanel:open', () => {
		syncRevealDelays(true)
	})

	panel.addEventListener('tilepanel:close-start', () => {
		syncRevealDelays(false)
	})

	panel.addEventListener('tilepanel:closed', () => {
		syncRevealDelays(false)
	})

	syncRevealDelays(false)
	panel.dataset.panelRevealReady = 'true'
}

function initPanelScrollNavigation() {
	const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
	const panels = Array.from(document.querySelectorAll('.tile-panel'))

	const getScrollBehavior = () => (reduceMotionQuery.matches ? 'auto' : 'smooth')

	const getNextSection = heroSection => {
		let nextSection = heroSection.nextElementSibling

		while (nextSection && !(nextSection instanceof HTMLElement)) {
			nextSection = nextSection.nextElementSibling
		}

		return nextSection instanceof HTMLElement ? nextSection : null
	}

	for (const panel of panels) {
		const scrollRoot = panel.querySelector('[data-panel-scroll-root]')
		const heroSection = scrollRoot?.querySelector('[data-panel-scroll-hero]')
		const scrollDownButton = panel.querySelector('[data-panel-scroll-next]')
		const scrollTopButton = panel.querySelector('[data-panel-scroll-top]')
		if (!scrollRoot || !heroSection || (!scrollDownButton && !scrollTopButton)) {
			continue
		}

		const nextSection = getNextSection(heroSection)
		let syncFrameId = 0

		const clearSyncFrame = () => {
			if (!syncFrameId) {
				return
			}

			window.cancelAnimationFrame(syncFrameId)
			syncFrameId = 0
		}

		const setScrollTopButtonVisibility = isVisible => {
			if (!scrollTopButton) {
				return
			}

			scrollTopButton.classList.toggle('is-visible', isVisible)
			scrollTopButton.setAttribute('aria-hidden', String(!isVisible))
			scrollTopButton.tabIndex = isVisible ? 0 : -1
		}

		const setScrollDownButtonState = ({ isHidden, isDisabled }) => {
			if (!scrollDownButton) {
				return
			}

			scrollDownButton.classList.toggle('is-hidden', isHidden)
			scrollDownButton.disabled = isDisabled
			scrollDownButton.setAttribute('aria-hidden', String(isHidden))
			scrollDownButton.tabIndex = !isHidden && !isDisabled ? 0 : -1
		}

		const scrollToTop = top => {
			const maxScrollTop = Math.max(scrollRoot.scrollHeight - scrollRoot.clientHeight, 0)
			const nextTop = Math.max(0, Math.min(top, maxScrollTop))

			scrollRoot.scrollTo({
				top: nextTop,
				behavior: getScrollBehavior(),
			})
		}

		const getStaticOffsetTop = element => {
			let top = 0
			let current = element

			while (current instanceof HTMLElement) {
				top += current.offsetTop
				current = current.offsetParent
			}

			return top
		}

		const getTargetScrollTop = target => {
			if (!(target instanceof HTMLElement)) {
				return scrollRoot.clientHeight
			}

			return Math.max(getStaticOffsetTop(target) - getStaticOffsetTop(scrollRoot), 0)
		}

		const syncButtons = () => {
			clearSyncFrame()

			const maxScrollTop = Math.max(scrollRoot.scrollHeight - scrollRoot.clientHeight, 0)
			const topThreshold = Math.min(Math.max(Math.round(scrollRoot.clientHeight * 0.22), 160), 300)
			const downHideThreshold = Math.min(Math.max(Math.round(scrollRoot.clientHeight * 0.08), 48), 120)
			const isScrollTopVisible = maxScrollTop > 0 && scrollRoot.scrollTop > topThreshold
			const isScrollDownHidden = maxScrollTop <= 0 || scrollRoot.scrollTop > downHideThreshold

			setScrollTopButtonVisibility(isScrollTopVisible)
			setScrollDownButtonState({
				isHidden: isScrollDownHidden,
				isDisabled: maxScrollTop <= 0 || !nextSection,
			})
		}

		const scheduleSync = () => {
			if (syncFrameId) {
				return
			}

			syncFrameId = window.requestAnimationFrame(() => {
				syncFrameId = 0
				syncButtons()
			})
		}

		scrollDownButton?.addEventListener('click', () => {
			scrollToTop(nextSection ? getTargetScrollTop(nextSection) : scrollRoot.clientHeight)
		})

		scrollTopButton?.addEventListener('click', () => {
			scrollToTop(0)
		})

		scrollRoot.addEventListener('scroll', scheduleSync, { passive: true })
		panel.addEventListener('tilepanel:open', () => {
			window.requestAnimationFrame(scheduleSync)
		})
		panel.addEventListener('tilepanel:closed', () => {
			clearSyncFrame()
			syncButtons()
		})
		panel.addEventListener('transitionend', event => {
			if (event.target !== panel) {
				return
			}

			if (event.propertyName !== 'width' && event.propertyName !== 'height') {
				return
			}

			scheduleSync()
		})

		window.addEventListener('resize', scheduleSync)
		addMediaQueryListener(reduceMotionQuery, scheduleSync)
		syncButtons()
	}
}

function initStackPanelHoverTrail() {
	const stackPanel = document.getElementById('stack-panel')
	if (!stackPanel) {
		return
	}

	const items = Array.from(stackPanel.querySelectorAll('.stack-panel__item'))
	if (!items.length) {
		return
	}

	const hoverQuery = window.matchMedia('(hover: hover) and (pointer: fine)')
	const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
	const trailHoldMs = 140
	const trailTimers = new WeakMap()

	const clearInteractiveDelay = item => {
		item.style.transitionDelay = '0s, 0s, 0s'
	}

	const clearTrailTimer = item => {
		const timerId = trailTimers.get(item)
		if (!timerId) {
			return
		}

		window.clearTimeout(timerId)
		trailTimers.delete(item)
	}

	const resetItemState = item => {
		clearTrailTimer(item)
		item.classList.remove('is-hover-active', 'is-hover-trail')
	}

	const activateItem = item => {
		clearInteractiveDelay(item)
		clearTrailTimer(item)
		item.classList.remove('is-hover-trail')
		item.classList.add('is-hover-active')
	}

	const releaseItem = item => {
		clearInteractiveDelay(item)
		item.classList.remove('is-hover-active')
		clearTrailTimer(item)

		if (reduceMotionQuery.matches) {
			item.classList.remove('is-hover-trail')
			return
		}

		item.classList.add('is-hover-trail')

		const timerId = window.setTimeout(() => {
			item.classList.remove('is-hover-trail')
			trailTimers.delete(item)
		}, trailHoldMs)

		trailTimers.set(item, timerId)
	}

	const resetAllStates = () => {
		items.forEach(resetItemState)
	}

	items.forEach(item => {
		item.addEventListener('mouseenter', () => {
			if (!hoverQuery.matches) {
				return
			}

			activateItem(item)
		})

		item.addEventListener('mouseleave', () => {
			if (!hoverQuery.matches) {
				resetItemState(item)
				return
			}

			releaseItem(item)
		})
	})

	addMediaQueryListener(hoverQuery, event => {
		if (!event.matches) {
			resetAllStates()
		}
	})

	addMediaQueryListener(reduceMotionQuery, () => {
		resetAllStates()
	})

	stackPanel.addEventListener('tilepanel:closed', resetAllStates)
}

function initPortfolioScrollReveal() {
	const panel = document.getElementById('portfolio-panel')
	const scrollRoot = panel?.querySelector('.portfolio-list[data-panel-scroll-root]')
	if (!panel || !scrollRoot) {
		return
	}

	const items = Array.from(scrollRoot.querySelectorAll('.portfolio-work'))
	if (!items.length) {
		return
	}

	const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
	let syncFrameId = 0
	let motionReadyFrameId = 0
	let openSyncFrameId = 0

	for (const item of items) {
		item.setAttribute('data-portfolio-scroll-item', '')
	}

	const isPanelMotionReady = () => !panel.hidden && panel.classList.contains('is-open') && scrollRoot.clientHeight > 0

	const clearSyncFrame = () => {
		if (!syncFrameId) {
			return
		}

		window.cancelAnimationFrame(syncFrameId)
		syncFrameId = 0
	}

	const clearMotionReadyFrame = () => {
		if (!motionReadyFrameId) {
			return
		}

		window.cancelAnimationFrame(motionReadyFrameId)
		motionReadyFrameId = 0
	}

	const clearOpenSyncFrame = () => {
		if (!openSyncFrameId) {
			return
		}

		window.cancelAnimationFrame(openSyncFrameId)
		openSyncFrameId = 0
	}

	const showAllItems = () => {
		scrollRoot.removeAttribute('data-portfolio-scroll')
		scrollRoot.classList.remove('is-scroll-motion-ready')

		for (const item of items) {
			item.dataset.portfolioScrollState = 'visible'
		}
	}

	const syncItemStates = ({ armMotion = false } = {}) => {
		clearSyncFrame()

		if (reduceMotionQuery.matches || !isPanelMotionReady()) {
			showAllItems()
			return
		}

		scrollRoot.dataset.portfolioScroll = 'active'

		const rootRect = scrollRoot.getBoundingClientRect()
		const revealTop = rootRect.top + rootRect.height * 0.14
		const revealBottom = rootRect.bottom - rootRect.height * 0.08

		for (const item of items) {
			const rect = item.getBoundingClientRect()
			const nextState =
				rect.bottom <= revealTop ? 'above' : rect.top >= revealBottom ? 'below' : 'visible'

			item.dataset.portfolioScrollState = nextState
		}

		if (!armMotion) {
			return
		}

		clearMotionReadyFrame()
		motionReadyFrameId = window.requestAnimationFrame(() => {
			motionReadyFrameId = 0

			if (!reduceMotionQuery.matches && isPanelMotionReady()) {
				scrollRoot.classList.add('is-scroll-motion-ready')
			}
		})
	}

	const scheduleOpenSync = () => {
		clearSyncFrame()
		clearMotionReadyFrame()
		clearOpenSyncFrame()
		showAllItems()

		let attempts = 0
		let readyFrames = 0

		const step = () => {
			attempts += 1

			if (reduceMotionQuery.matches || panel.hidden) {
				openSyncFrameId = 0
				showAllItems()
				return
			}

			readyFrames = isPanelMotionReady() ? readyFrames + 1 : 0

			if (readyFrames >= 2 || attempts >= 20) {
				openSyncFrameId = 0
				syncItemStates({ armMotion: true })
				return
			}

			openSyncFrameId = window.requestAnimationFrame(step)
		}

		openSyncFrameId = window.requestAnimationFrame(step)
	}

	const scheduleSync = (options = {}) => {
		if (options.armMotion) {
			scheduleOpenSync()
			return
		}

		if (syncFrameId) {
			return
		}

		syncFrameId = window.requestAnimationFrame(() => {
			syncFrameId = 0
			syncItemStates()
		})
	}

	panel.addEventListener('tilepanel:open', () => {
		clearSyncFrame()
		clearMotionReadyFrame()
		clearOpenSyncFrame()
		showAllItems()

		window.requestAnimationFrame(() => {
			if (reduceMotionQuery.matches || isPanelMotionReady()) {
				scheduleOpenSync()
			}
		})
	})

	panel.addEventListener('tilepanel:closed', () => {
		clearSyncFrame()
		clearMotionReadyFrame()
		clearOpenSyncFrame()
		showAllItems()
	})

	panel.addEventListener('transitionend', event => {
		if (event.target !== panel || !panel.classList.contains('is-open')) {
			return
		}

		if (event.propertyName !== 'width' && event.propertyName !== 'height') {
			return
		}

		scheduleOpenSync()
	})

	scrollRoot.addEventListener(
		'scroll',
		() => {
			if (reduceMotionQuery.matches || !isPanelMotionReady()) {
				return
			}

			scheduleSync()
		},
		{ passive: true },
	)

	window.addEventListener('resize', () => {
		scheduleSync()
	})

	addMediaQueryListener(reduceMotionQuery, () => {
		if (reduceMotionQuery.matches) {
			clearSyncFrame()
			clearMotionReadyFrame()
			clearOpenSyncFrame()
			showAllItems()
			return
		}

		scheduleOpenSync()
	})

	if (!panel.hidden) {
		if (isPanelMotionReady()) {
			scheduleOpenSync()
			return
		}

		showAllItems()
		return
	}

	showAllItems()
}

function initExpandingPanel(trigger, panel, closeButton, reduceMotionQuery, focusableSelector, historyApi) {
	const instantPanelQuery = panel.id === 'contact-panel' ? window.matchMedia('(max-width: 640px)') : null
	const panelScrollRoot = panel.querySelector('[data-panel-scroll-root]')
	const page = document.querySelector('.page')
	const pageReturnRevealDelay = 220
	const pageTileRevealCleanupDelay = 1040
	let isOpen = false
	let closeTimerId = 0
	let focusTimerId = 0
	let returnStateFrameId = 0
	let returnStateTimeoutId = 0
	let revealStateTimeoutId = 0
	let shouldReturnFocusToTrigger = false
	let isHashFallbackActive = false
	let swipeCloseDelta = 0
	let swipeResetTimerId = 0

	setupPanelReveal(panel)

	const shouldSkipPanelMotion = () =>
		reduceMotionQuery.matches || Boolean(instantPanelQuery && instantPanelQuery.matches)

	const getOpenPanelHeight = () => {
		const viewport = window.visualViewport
		return `${Math.max(Math.round(viewport ? viewport.height : window.innerHeight), 1)}px`
	}

	const syncPanelStart = () => {
		const rect = trigger.getBoundingClientRect()
		const triggerStyle = window.getComputedStyle(trigger)
		const triggerBackground = triggerStyle.backgroundColor

		panel.style.top = `${rect.top}px`
		panel.style.left = `${rect.left}px`
		panel.style.width = `${Math.max(rect.width, 1)}px`
		panel.style.height = `${Math.max(rect.height, 1)}px`
		panel.style.backgroundColor = triggerBackground
	}

	const syncPanelOpenState = () => {
		panel.style.top = '0px'
		panel.style.left = '0px'
		panel.style.width = `${window.innerWidth}px`
		panel.style.height = getOpenPanelHeight()
		panel.style.backgroundColor = 'rgba(255, 255, 255, 0.98)'
	}

	const focusCloseButton = () => {
		closeButton.focus({ preventScroll: true })
	}

	const clearPageReturnFrame = () => {
		if (!returnStateFrameId) {
			return
		}

		window.cancelAnimationFrame(returnStateFrameId)
		returnStateFrameId = 0
	}

	const clearPageReturnTimeout = () => {
		if (!returnStateTimeoutId) {
			return
		}

		window.clearTimeout(returnStateTimeoutId)
		returnStateTimeoutId = 0
	}

	const clearPageRevealTimeout = () => {
		if (!revealStateTimeoutId) {
			return
		}

		window.clearTimeout(revealStateTimeoutId)
		revealStateTimeoutId = 0
	}

	const clearPagePanelOrigin = () => {
		if (!page) {
			return
		}

		for (const originTrigger of page.querySelectorAll('[data-expand-trigger].is-panel-origin')) {
			originTrigger.classList.remove('is-panel-origin')
		}
	}

	const activatePagePanelState = () => {
		if (!page) {
			return
		}

		clearPageReturnFrame()
		clearPageReturnTimeout()
		clearPageRevealTimeout()
		page.classList.remove('is-panel-returning')
		page.classList.remove('is-panel-revealing')
		clearPagePanelOrigin()
		trigger.classList.add('is-panel-origin')
		page.classList.add('is-panel-active')
		page.dataset.activePanel = panel.id
	}

	const beginPagePanelReturn = (skipMotion = false) => {
		if (!page) {
			return
		}

		clearPageReturnFrame()
		clearPageReturnTimeout()
		clearPageRevealTimeout()
		page.classList.remove('is-panel-active')
		page.classList.remove('is-panel-revealing')
		page.removeAttribute('data-active-panel')

		if (skipMotion) {
			page.classList.remove('is-panel-returning')
			return
		}

		page.classList.add('is-panel-returning')
		returnStateTimeoutId = window.setTimeout(() => {
			returnStateTimeoutId = 0
			page.classList.add('is-panel-revealing')
			revealStateTimeoutId = window.setTimeout(() => {
				page.classList.remove('is-panel-revealing')
				revealStateTimeoutId = 0
			}, pageTileRevealCleanupDelay)
			returnStateFrameId = window.requestAnimationFrame(() => {
				page.classList.remove('is-panel-returning')
				returnStateFrameId = 0
			})
		}, pageReturnRevealDelay)
	}

	const resetPagePanelState = ({ preserveRevealState = false } = {}) => {
		if (!page) {
			return
		}

		clearPageReturnFrame()
		clearPageReturnTimeout()
		if (!preserveRevealState) {
			clearPageRevealTimeout()
		}
		clearPagePanelOrigin()
		page.classList.remove('is-panel-active')
		page.classList.remove('is-panel-returning')
		if (!preserveRevealState) {
			page.classList.remove('is-panel-revealing')
		}
		page.removeAttribute('data-active-panel')
	}

	const getHashPanelId = () => {
		const hashValue = window.location.hash ? decodeURIComponent(window.location.hash.slice(1)) : ''
		return hashValue || null
	}

	const resetSwipeCloseGesture = () => {
		swipeCloseDelta = 0
		window.clearTimeout(swipeResetTimerId)
		swipeResetTimerId = 0
	}

	const scheduleSwipeReset = () => {
		window.clearTimeout(swipeResetTimerId)
		swipeResetTimerId = window.setTimeout(resetSwipeCloseGesture, 180)
	}

	const normalizeWheelDelta = event => {
		if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
			return event.deltaY * 16
		}

		if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
			return event.deltaY * window.innerHeight
		}

		return event.deltaY
	}

	const getFocusableElements = () =>
		Array.from(panel.querySelectorAll(focusableSelector)).filter(
			element => element.getClientRects().length > 0 && !element.closest('[inert]'),
		)

	const syncHistoryOnOpen = () => {
		const activeHashPanelId = getHashPanelId()
		if (activeHashPanelId === panel.id) {
			return
		}

		isHashFallbackActive = true

		try {
			const nextUrl = `${window.location.pathname}${window.location.search}#${encodeURIComponent(panel.id)}`
			window.history.pushState(historyApi.createPanelHistoryState(panel.id), '', nextUrl)
			return
		} catch (error) {}

		window.location.hash = encodeURIComponent(panel.id)
	}

	const openPanel = (openedWithKeyboard = false, syncHistory = true) => {
		if (isOpen) {
			return
		}

		isOpen = true
		shouldReturnFocusToTrigger = openedWithKeyboard
		window.clearTimeout(closeTimerId)
		window.clearTimeout(focusTimerId)
		syncPanelStart()

		panel.hidden = false
		panel.setAttribute('aria-hidden', 'false')
		panel.classList.remove('is-closing')
		panel.classList.remove('is-open')
		panel.classList.add('is-visible')
		activatePagePanelState()
		panel.dispatchEvent(new CustomEvent('tilepanel:open'))
		trigger.setAttribute('aria-expanded', 'true')
		document.documentElement.classList.add('tile-panel-active')
		document.body.classList.add('tile-panel-active')

		if (syncHistory) {
			syncHistoryOnOpen()
		}

		if (shouldSkipPanelMotion()) {
			syncPanelOpenState()
			panel.classList.add('is-open')
			if (openedWithKeyboard) {
				focusCloseButton()
			}
			return
		}

		panel.getBoundingClientRect()
		window.requestAnimationFrame(() => {
			syncPanelOpenState()
			panel.classList.add('is-open')
		})

		if (openedWithKeyboard) {
			focusTimerId = window.setTimeout(focusCloseButton, 720)
		}
	}

	const finishClose = () => {
		if (isOpen) {
			return
		}

		window.clearTimeout(closeTimerId)
		window.clearTimeout(focusTimerId)
		resetSwipeCloseGesture()
		isHashFallbackActive = false
		panel.classList.remove('is-closing')
		panel.classList.remove('is-visible')
		panel.hidden = true
		panel.setAttribute('aria-hidden', 'true')
		resetPagePanelState({ preserveRevealState: true })
		panel.dispatchEvent(new CustomEvent('tilepanel:closed'))
		document.documentElement.classList.remove('tile-panel-active')
		document.body.classList.remove('tile-panel-active')

		if (shouldReturnFocusToTrigger) {
			trigger.focus({ preventScroll: true })
		}
	}

	const startClosePanel = () => {
		if (!isOpen) {
			return
		}

		isOpen = false
		window.clearTimeout(focusTimerId)
		syncPanelStart()
		const skipPanelMotion = shouldSkipPanelMotion()
		beginPagePanelReturn(skipPanelMotion)
		panel.dispatchEvent(new CustomEvent('tilepanel:close-start'))
		trigger.setAttribute('aria-expanded', 'false')
		panel.classList.add('is-closing')
		panel.classList.remove('is-open')

		if (skipPanelMotion) {
			finishClose()
			return
		}

		closeTimerId = window.setTimeout(finishClose, 900)
	}

	const closePanel = (syncHistory = true) => {
		if (!isOpen) {
			return
		}

		const activeHistoryPanelId = historyApi.getHistoryPanelId(window.history.state)
		const activeHashPanelId = getHashPanelId()
		if (syncHistory && (activeHistoryPanelId === panel.id || activeHashPanelId === panel.id)) {
			window.history.back()
			return
		}

		startClosePanel()
	}

	const handleWheelSwipeClose = event => {
		if (!isOpen || event.ctrlKey) {
			return
		}

		const horizontalDelta = event.deltaX
		const verticalDelta = event.deltaY
		const isStrongHorizontalSwipe =
			Math.abs(horizontalDelta) >= 8 && Math.abs(horizontalDelta) > Math.abs(verticalDelta) * 1.15

		if (!isStrongHorizontalSwipe) {
			if (Math.abs(verticalDelta) > Math.abs(horizontalDelta)) {
				resetSwipeCloseGesture()
			}
			return
		}

		event.preventDefault()
		swipeCloseDelta += Math.abs(horizontalDelta)
		scheduleSwipeReset()

		if (swipeCloseDelta >= 140) {
			resetSwipeCloseGesture()
			closePanel()
		}
	}

	const handlePanelWheelForwarding = event => {
		if (!isOpen || event.defaultPrevented || event.ctrlKey || !panelScrollRoot) {
			return
		}

		const verticalDelta = Math.abs(event.deltaY)
		const horizontalDelta = Math.abs(event.deltaX)

		if (verticalDelta <= horizontalDelta || verticalDelta < 1) {
			return
		}

		const eventTarget = event.target instanceof Element ? event.target : null
		const isHoveringScrollableContent = eventTarget?.closest('[data-panel-scroll-root]')

		if (isHoveringScrollableContent) {
			return
		}

		const maxScrollTop = panelScrollRoot.scrollHeight - panelScrollRoot.clientHeight
		if (maxScrollTop <= 0) {
			return
		}

		const nextScrollTop = Math.max(0, Math.min(panelScrollRoot.scrollTop + normalizeWheelDelta(event), maxScrollTop))

		if (Math.abs(nextScrollTop - panelScrollRoot.scrollTop) < 0.5) {
			return
		}

		event.preventDefault()
		panelScrollRoot.scrollTop = nextScrollTop
	}

	trigger.addEventListener('click', () => {
		openPanel(false)
	})
	trigger.addEventListener('keydown', event => {
		if (event.key !== 'Enter' && event.key !== ' ') {
			return
		}

		event.preventDefault()
		openPanel(true)
	})

	closeButton.addEventListener('click', closePanel)
	window.addEventListener('wheel', handleWheelSwipeClose, { passive: false, capture: true })
	panel.addEventListener('wheel', handlePanelWheelForwarding, { passive: false })
	panel.addEventListener('transitionend', event => {
		if (event.target === panel && !isOpen && (event.propertyName === 'width' || event.propertyName === 'height')) {
			finishClose()
		}
	})

	window.addEventListener('popstate', event => {
		const activeHistoryPanelId = historyApi.getHistoryPanelId(event.state)

		if (activeHistoryPanelId === panel.id) {
			if (!isOpen) {
				openPanel(false, false)
			}
			return
		}

		if (isOpen) {
			closePanel(false)
		}
	})

	window.addEventListener('hashchange', () => {
		const activeHashPanelId = getHashPanelId()

		if (activeHashPanelId === panel.id) {
			if (!isOpen) {
				openPanel(false, false)
			}
			return
		}

		if (isOpen) {
			closePanel(false)
		}
	})

	document.addEventListener('keydown', event => {
		if (!isOpen) {
			return
		}

		if (event.key === 'Escape') {
			closePanel()
			return
		}

		if (event.key !== 'Tab') {
			return
		}

		const focusableElements = getFocusableElements()
		if (!focusableElements.length) {
			event.preventDefault()
			panel.focus({ preventScroll: true })
			return
		}

		const firstElement = focusableElements[0]
		const lastElement = focusableElements[focusableElements.length - 1]

		if (event.shiftKey && document.activeElement === firstElement) {
			event.preventDefault()
			lastElement.focus({ preventScroll: true })
			return
		}

		if (!event.shiftKey && document.activeElement === lastElement) {
			event.preventDefault()
			firstElement.focus({ preventScroll: true })
		}
	})

	window.addEventListener('resize', () => {
		if (isOpen) {
			syncPanelOpenState()
		}
	})

	window.visualViewport?.addEventListener('resize', () => {
		if (isOpen) {
			syncPanelOpenState()
		}
	})

	if (historyApi.getHistoryPanelId(window.history.state) === panel.id || getHashPanelId() === panel.id) {
		openPanel(false, false)
	}
}

function initContactPanel() {
	const panel = document.getElementById('contact-panel')
	if (!panel) {
		return
	}

	const panelScrollRoot = panel.querySelector('[data-panel-scroll-root]')
	const form = panel.querySelector('[data-contact-form]')
	const contactLayout = panel.querySelector('.contact-layout')
	const mobileContactQuery = window.matchMedia('(max-width: 640px)')
	let mobileFieldTimerId = 0
	let activeMobileField = null

	const isPanelActive = () => !panel.hidden && (panel.classList.contains('is-open') || panel.classList.contains('is-visible'))

	const clearMobileFieldTimer = () => {
		if (!mobileFieldTimerId) {
			return
		}

		window.clearTimeout(mobileFieldTimerId)
		mobileFieldTimerId = 0
	}

	const resetMobileViewportMetrics = () => {
		panel.style.removeProperty('height')
		panelScrollRoot?.style.removeProperty('scrollPaddingBottom')
		contactLayout?.style.removeProperty('scrollPaddingBottom')

		for (const field of panel.querySelectorAll('input, textarea, select')) {
			if (field instanceof HTMLElement) {
				field.style.removeProperty('scrollMarginBottom')
			}
		}
	}

	const syncMobileViewportMetrics = () => {
		if (!mobileContactQuery.matches || !isPanelActive()) {
			resetMobileViewportMetrics()
			return
		}

		const viewport = window.visualViewport
		const viewportHeight = Math.max(Math.round(viewport ? viewport.height : window.innerHeight), 0)
		const viewportOffsetTop = viewport ? viewport.offsetTop : 0
		const keyboardOffset = Math.max(Math.round(window.innerHeight - viewportHeight - viewportOffsetTop), 0)
		const bottomSpacing = `${Math.max(keyboardOffset + 24, 24)}px`

		if (viewportHeight) {
			panel.style.height = `${viewportHeight}px`
		}

		panelScrollRoot?.style.setProperty('scrollPaddingBottom', bottomSpacing)
		contactLayout?.style.setProperty('scrollPaddingBottom', bottomSpacing)

		for (const field of panel.querySelectorAll('input, textarea, select')) {
			if (field instanceof HTMLElement) {
				field.style.scrollMarginBottom = `${keyboardOffset + 16}px`
			}
		}
	}

	const scrollMobileFieldIntoView = field => {
		if (!field || !panelScrollRoot || !isPanelActive()) {
			return
		}

		field.scrollIntoView({
			block: 'center',
			inline: 'nearest',
			behavior: 'auto',
		})
	}

	const scheduleMobileFieldSync = field => {
		clearMobileFieldTimer()
		activeMobileField = field

		if (!mobileContactQuery.matches || !isPanelActive()) {
			return
		}

		mobileFieldTimerId = window.setTimeout(() => {
			syncMobileViewportMetrics()
			scrollMobileFieldIntoView(field)
			mobileFieldTimerId = 0
		}, 260)
	}
	panel.addEventListener('tilepanel:open', () => {
		window.requestAnimationFrame(() => {
			syncMobileViewportMetrics()
		})
	})

	panel.addEventListener('tilepanel:closed', () => {
		clearMobileFieldTimer()
		activeMobileField = null
		resetMobileViewportMetrics()
	})

	if (!form) {
		return
	}

	const fileInput = form.querySelector('input[type="file"][name="attachments[]"], input[type="file"][name="attachments"]')
	const fileLabel = form.querySelector('[data-file-label]')
	const submitButton = form.querySelector('.contact-form__submit')
	const submitButtonText = submitButton ? submitButton.querySelector('span') : null
	const statusMessage = form.querySelector('[data-contact-status]')
	const endpoint = form.getAttribute('action') || 'send-email.php'
	const defaultFileLabel = fileLabel ? fileLabel.textContent : ''
	const defaultSubmitLabel = submitButtonText ? submitButtonText.textContent : ''

	const setStatus = (message = '', state = '') => {
		if (!statusMessage) {
			return
		}

		statusMessage.hidden = !message
		statusMessage.textContent = message

		if (state) {
			statusMessage.dataset.state = state
			return
		}

		delete statusMessage.dataset.state
	}

	const setSubmittingState = isSubmitting => {
		form.classList.toggle('is-submitting', isSubmitting)

		if (!submitButton) {
			return
		}

		submitButton.disabled = isSubmitting
		submitButton.setAttribute('aria-busy', String(isSubmitting))

		if (submitButtonText) {
			submitButtonText.textContent = isSubmitting ? 'Wysyłanie...' : defaultSubmitLabel
		}
	}

	if (fileInput && fileLabel) {
		fileInput.addEventListener('change', () => {
			const count = fileInput.files ? fileInput.files.length : 0
			fileLabel.textContent = count === 0 ? defaultFileLabel : `Wybrane pliki: ${count}`
		})
	}

	form.addEventListener('focusin', event => {
		const field =
			event.target instanceof HTMLElement ? event.target.closest('input, textarea, select') : null
		if (!field || !mobileContactQuery.matches) {
			return
		}

		scheduleMobileFieldSync(field)
	})

	form.addEventListener('focusout', () => {
		window.setTimeout(() => {
			const activeElement = document.activeElement
			if (!(activeElement instanceof HTMLElement) || !form.contains(activeElement)) {
				activeMobileField = null
			}
		}, 0)
	})

	addMediaQueryListener(mobileContactQuery, () => {
		if (mobileContactQuery.matches) {
			syncMobileViewportMetrics()
			return
		}

		clearMobileFieldTimer()
		activeMobileField = null
		resetMobileViewportMetrics()
	})

	if (window.visualViewport) {
		const handleVisualViewportChange = () => {
			if (!mobileContactQuery.matches || !isPanelActive()) {
				return
			}

			syncMobileViewportMetrics()

			const activeElement = document.activeElement
			if (!(activeElement instanceof HTMLElement) || !form.contains(activeElement)) {
				return
			}

			if (!activeElement.matches('input, textarea, select')) {
				return
			}

			scheduleMobileFieldSync(activeElement)
		}

		window.visualViewport.addEventListener('resize', handleVisualViewportChange)
		window.visualViewport.addEventListener('scroll', handleVisualViewportChange)
	}

	form.addEventListener('submit', async event => {
		event.preventDefault()

		if (!form.reportValidity()) {
			return
		}

		const formData = new FormData(form)

		setSubmittingState(true)
		setStatus('Wysyłanie wiadomości...', 'pending')

		try {
			const response = await fetch(endpoint, {
				method: 'POST',
				body: formData,
				headers: {
					Accept: 'application/json',
				},
			})

			const result = await response.json().catch(() => null)

			if (!response.ok || !result || result.ok !== true) {
				throw new Error(result && result.message ? result.message : 'Nie udało się wysłać wiadomości.')
			}

			form.reset()

			if (fileLabel) {
				fileLabel.textContent = defaultFileLabel
			}

			setStatus(result.message || 'Wiadomość została wysłana.', 'success')
		} catch (error) {
			const fallbackMessage = 'Nie udało się wysłać wiadomości. Spróbuj ponownie za chwilę.'
			const message = error instanceof Error && error.message ? error.message : fallbackMessage
			setStatus(message, 'error')
		} finally {
			setSubmittingState(false)
		}
	})
}

function initNetworkCanvas(backgroundScene) {
	const canvas = backgroundScene.querySelector('[data-network-canvas]')
	if (!canvas) {
		return
	}

	const context = canvas.getContext('2d')
	if (!context) {
		return
	}

	const tiles = document.querySelector('.tiles')
	const strategicTile = document.querySelector('.tile--strategic')
	const root = document.documentElement
	const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
	const desktopQuery = window.matchMedia('(min-width: 801px)')

	const target = { x: 0, y: 0 }
	let width = 0
	let height = 0
	let networkLimitY = 0
	let networkDrawHeight = 0
	let strategicRegion = null
	let scale = 1
	let animationFrameId = 0
	let animateNetwork = true
	let isEnabled = false
	let sceneRect = backgroundScene.getBoundingClientRect()
	let points = []

	const syncEnabledState = () => {
		const shouldEnable =
			desktopQuery.matches && !reduceMotionQuery.matches && !root.classList.contains('tile-panel-active')
		if (shouldEnable === isEnabled) {
			if (isEnabled) {
				resizeCanvas()
			} else {
				clearCanvas()
			}
			return
		}

		isEnabled = shouldEnable
		backgroundScene.classList.toggle('background--network-active', isEnabled)

		if (isEnabled) {
			resizeCanvas()
			startAnimation()
			return
		}

		stopAnimation()
		clearCanvas()
	}

	const resizeCanvas = () => {
		sceneRect = backgroundScene.getBoundingClientRect()
		width = Math.max(Math.round(sceneRect.width), 1)
		height = Math.max(Math.round(sceneRect.height), 1)
		networkLimitY = getNetworkLimitY()
		strategicRegion = getStrategicRegion()
		networkDrawHeight = getNetworkDrawHeight()
		scale = Math.min(window.devicePixelRatio || 1, 2)

		canvas.width = Math.round(width * scale)
		canvas.height = Math.round(height * scale)
		canvas.style.width = `${width}px`
		canvas.style.height = `${height}px`

		context.setTransform(scale, 0, 0, scale, 0, 0)
		target.x = width / 2
		target.y = Math.max(networkLimitY / 2, 1)
		points = createPoints(width, Math.max(networkDrawHeight, 1))
	}

	const handleMouseMove = event => {
		if (!isEnabled) {
			return
		}

		const pointerX = event.clientX - sceneRect.left
		const pointerY = event.clientY - sceneRect.top
		const isPointerInUpperArea = pointerY >= 0 && pointerY < networkLimitY
		const isPointerInStrategicArea = isPointInsideRect(pointerX, pointerY, strategicRegion)
		const isPointerInInteractiveArea = isPointerInUpperArea || isPointerInStrategicArea

		backgroundScene.classList.toggle('background--network-muted', !isPointerInInteractiveArea)

		if (!isPointerInInteractiveArea) {
			return
		}

		target.x = pointerX
		target.y = pointerY
	}

	const handleScroll = () => {
		sceneRect = backgroundScene.getBoundingClientRect()
		networkLimitY = getNetworkLimitY()
		strategicRegion = getStrategicRegion()
		networkDrawHeight = getNetworkDrawHeight()
		animateNetwork = window.scrollY <= window.innerHeight
	}

	const handleResize = () => {
		handleScroll()
		if (isEnabled) {
			resizeCanvas()
		}
	}

	const animate = now => {
		if (!isEnabled) {
			animationFrameId = 0
			return
		}

		updatePointShift(points, now)
		context.clearRect(0, 0, width, height)

		if (animateNetwork && hasVisibleNetworkArea()) {
			context.save()
			context.beginPath()
			context.rect(0, 0, width, networkLimitY)
			if (strategicRegion) {
				context.rect(strategicRegion.x, strategicRegion.y, strategicRegion.width, strategicRegion.height)
			}
			context.clip()
			drawNetwork(context, points, target)
			context.restore()
		}

		animationFrameId = window.requestAnimationFrame(animate)
	}

	window.addEventListener('mousemove', handleMouseMove, { passive: true })
	window.addEventListener('resize', handleResize)
	window.addEventListener('scroll', handleScroll, { passive: true })
	addMediaQueryListener(desktopQuery, syncEnabledState)
	addMediaQueryListener(reduceMotionQuery, syncEnabledState)

	const panelStateObserver = new MutationObserver(syncEnabledState)
	panelStateObserver.observe(root, { attributes: true, attributeFilter: ['class'] })

	handleScroll()
	syncEnabledState()

	function startAnimation() {
		if (!animationFrameId) {
			animationFrameId = window.requestAnimationFrame(animate)
		}
	}

	function stopAnimation() {
		if (animationFrameId) {
			window.cancelAnimationFrame(animationFrameId)
			animationFrameId = 0
		}
	}

	function clearCanvas() {
		context.clearRect(0, 0, width, height)
	}

	function getNetworkLimitY() {
		if (!tiles) {
			return height
		}

		const tilesRect = tiles.getBoundingClientRect()
		return clamp(Math.round(tilesRect.top - sceneRect.top), 0, height)
	}

	function getStrategicRegion() {
		if (getActivePageTheme() === 'white') {
			return null
		}

		if (!strategicTile) {
			return null
		}

		const strategicRect = strategicTile.getBoundingClientRect()
		const x = clamp(Math.round(strategicRect.left - sceneRect.left), 0, width)
		const y = clamp(Math.round(strategicRect.top - sceneRect.top), 0, height)
		const right = clamp(Math.round(strategicRect.right - sceneRect.left), 0, width)
		const bottom = clamp(Math.round(strategicRect.bottom - sceneRect.top), 0, height)
		const rectWidth = Math.max(right - x, 0)
		const rectHeight = Math.max(bottom - y, 0)

		if (!rectWidth || !rectHeight) {
			return null
		}

		return {
			x,
			y,
			width: rectWidth,
			height: rectHeight,
		}
	}

	function getNetworkDrawHeight() {
		if (!strategicRegion) {
			return networkLimitY
		}

		return Math.max(networkLimitY, strategicRegion.y + strategicRegion.height)
	}

	function hasVisibleNetworkArea() {
		return networkLimitY > 0 || Boolean(strategicRegion)
	}

	function isPointInsideRect(x, y, rect) {
		if (!rect) {
			return false
		}

		return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height
	}
}

function createPoints(width, height) {
	const points = []
	const stepX = width / 20
	const stepY = height / 20

	for (let x = 0; x < width; x += stepX) {
		for (let y = 0; y < height; y += stepY) {
			const pointX = x + Math.random() * stepX
			const pointY = y + Math.random() * stepY
			points.push(createPoint(pointX, pointY))
		}
	}

	for (const point of points) {
		point.closest = findClosestPoints(point, points)
	}

	return points
}

function createPoint(x, y) {
	const point = {
		x,
		y,
		originX: x,
		originY: y,
		active: 0,
		circleActive: 0,
		radius: 2 + Math.random() * 2,
		closest: [],
		shiftStart: 0,
		shiftDuration: 0,
		shiftFromX: x,
		shiftFromY: y,
		shiftToX: x,
		shiftToY: y,
	}

	setNextPointShift(point, performance.now(), true)
	return point
}

function findClosestPoints(point, points) {
	const closest = []

	for (const candidate of points) {
		if (candidate === point) {
			continue
		}

		let inserted = false
		for (let index = 0; index < 4; index += 1) {
			if (closest[index] === undefined) {
				closest[index] = candidate
				inserted = true
				break
			}
		}

		if (inserted) {
			continue
		}

		for (let index = 0; index < 4; index += 1) {
			if (getDistance(point, candidate) < getDistance(point, closest[index])) {
				closest[index] = candidate
				break
			}
		}
	}

	return closest
}

function updatePointShift(points, now) {
	for (const point of points) {
		const duration = Math.max(point.shiftDuration, 1)
		const progress = clamp((now - point.shiftStart) / duration, 0, 1)
		const eased = easeInOutCirc(progress)

		point.x = point.shiftFromX + (point.shiftToX - point.shiftFromX) * eased
		point.y = point.shiftFromY + (point.shiftToY - point.shiftFromY) * eased

		if (progress >= 1) {
			setNextPointShift(point, now, false)
		}
	}
}

function setNextPointShift(point, now, seed) {
	if (seed) {
		point.x = point.originX
		point.y = point.originY
	}

	point.shiftFromX = point.x
	point.shiftFromY = point.y
	point.shiftToX = point.originX - 50 + Math.random() * 100
	point.shiftToY = point.originY - 50 + Math.random() * 100
	point.shiftDuration = 1000 + Math.random() * 1000
	point.shiftStart = seed ? now - Math.random() * point.shiftDuration : now
}

function drawNetwork(context, points, target) {
	const tone = getNetworkTone()

	for (const point of points) {
		const distance = Math.abs(getDistance(target, point))

		if (distance < 1000) {
			point.active = 0.3
			point.circleActive = 0.6
		} else if (distance < 25000) {
			point.active = 0.1
			point.circleActive = 0.3
		} else if (distance < 50000) {
			point.active = 0.02
			point.circleActive = 0.1
		} else {
			point.active = 0
			point.circleActive = 0
		}

		drawLines(context, point, tone)
		drawCircle(context, point, tone)
	}
}

function drawLines(context, point, tone) {
	if (!point.active) {
		return
	}

	for (const closestPoint of point.closest) {
		if (!closestPoint) {
			continue
		}

		context.beginPath()
		context.moveTo(point.x, point.y)
		context.lineTo(closestPoint.x, closestPoint.y)
		context.strokeStyle = `rgba(${tone.rgb}, ${Math.min(point.active * tone.lineOpacity, 1)})`
		context.stroke()
	}
}

function drawCircle(context, point, tone) {
	if (!point.circleActive) {
		return
	}

	context.beginPath()
	context.arc(point.x, point.y, point.radius, 0, Math.PI * 2, false)
	context.fillStyle = `rgba(${tone.rgb}, ${Math.min(point.circleActive * tone.circleOpacity, 1)})`
	context.fill()
}

function getActivePageTheme() {
	return document.querySelector('.page')?.dataset.pageTheme || 'white'
}

function getNetworkTone() {
	const activeTheme = getActivePageTheme()

	if (activeTheme === 'white') {
		return {
			rgb: '154, 136, 255',
			lineOpacity: 0.48,
			circleOpacity: 0.6,
		}
	}

	return {
		rgb: '255, 255, 255',
		lineOpacity: 1,
		circleOpacity: 1,
	}
}

function getDistance(pointA, pointB) {
	return Math.pow(pointA.x - pointB.x, 2) + Math.pow(pointA.y - pointB.y, 2)
}

function easeInOutCirc(value) {
	if (value < 0.5) {
		return (1 - Math.sqrt(1 - Math.pow(2 * value, 2))) / 2
	}

	return (Math.sqrt(1 - Math.pow(-2 * value + 2, 2)) + 1) / 2
}

function addMediaQueryListener(query, handler) {
	if (typeof query.addEventListener === 'function') {
		query.addEventListener('change', handler)
		return
	}

	query.addListener(handler)
}

function clamp(value, min, max) {
	return Math.min(Math.max(value, min), max)
}

function initThemeSwitcher() {
	const page = document.querySelector('.page')
	const toggle = document.querySelector('[data-theme-toggle]')
	if (!page || !toggle) {
		return
	}

	const themeColorMeta =
		document.querySelector('meta[data-theme-color]') || document.querySelector('meta[name="theme-color"]')
	const backgroundScene = page.querySelector('.background')
	const baseLayer = document.createElement('div')
	const incomingLayer = document.createElement('div')
	baseLayer.className = 'page-theme-layer page-theme-layer--base'
	incomingLayer.className = 'page-theme-layer page-theme-layer--incoming'
	baseLayer.setAttribute('aria-hidden', 'true')
	incomingLayer.setAttribute('aria-hidden', 'true')

	const insertTarget = backgroundScene || page.firstChild
	page.insertBefore(incomingLayer, insertTarget)
	page.insertBefore(baseLayer, incomingLayer)

	const storageKey = 'folio-page-theme-v5'
	const themes = [
		{ id: 'white', label: 'White', accent: '#5f7286', meta: '#ffffff', backgroundVariant: '' },
		{ id: 'blue', label: 'Blue', accent: '#59a5ef', meta: '#1f568e', backgroundVariant: 'blue' },
		{ id: 'black', label: 'Black', accent: '#202122', meta: '#202122', backgroundVariant: 'black' },
	]
	const viewportThemes = [
		{ size: '2560x1440', query: window.matchMedia('(min-width: 1440px)') },
		{ size: '1920x1080', query: window.matchMedia('(min-width: 980px)') },
		{ size: '1280x800', query: window.matchMedia('(min-width: 621px)') },
		{ size: '768x1024', query: null },
	]

	let currentTheme = getStoredTheme()
	let themeRequestId = 0
	let activeLayerImage = ''
	let layerTransitionTimerId = 0

	const clearLayerTransition = () => {
		if (!layerTransitionTimerId) {
			return
		}

		window.clearTimeout(layerTransitionTimerId)
		layerTransitionTimerId = 0
	}

	const hideIncomingLayer = () => {
		incomingLayer.classList.remove('is-visible')
		incomingLayer.style.backgroundImage = ''
	}

	const applyTheme = (themeId, persist = true) => {
		const theme = themes.find(entry => entry.id === themeId) || themes[0]
		const backgroundSize = getBackgroundSize()
		const variantSuffix = theme.backgroundVariant ? ` ${theme.backgroundVariant}` : ''
		const imageUrl = new URL(`img/bg/bg_${backgroundSize}${variantSuffix}.jpg`, window.location.href).href
		const requestId = themeRequestId + 1

		currentTheme = theme.id
		themeRequestId = requestId
		page.dataset.pageTheme = theme.id
		document.documentElement.dataset.pageTheme = theme.id
		if (document.body) {
			document.body.dataset.pageTheme = theme.id
		}
		toggle.dataset.theme = theme.id
		toggle.style.color = theme.accent
		syncBrowserThemeColor(theme)
		toggle.setAttribute('aria-label', `Zmien wariant tla strony. Aktualnie: ${theme.label}`)
		toggle.setAttribute('title', `Tlo: ${theme.label}. Kliknij, aby przelaczyc.`)

		if (persist) {
			storeTheme(theme.id)
		}

		clearLayerTransition()

		if (theme.id === 'white') {
			page.style.backgroundImage = 'none'
			baseLayer.style.backgroundImage = ''
			activeLayerImage = ''
			hideIncomingLayer()
			return
		}

		const previewImage = new Image()
		previewImage.onload = () => {
			if (requestId !== themeRequestId) {
				return
			}

			const backgroundValue = `url("${imageUrl}")`
			page.style.backgroundImage = backgroundValue
			if (!activeLayerImage) {
				baseLayer.style.backgroundImage = backgroundValue
				activeLayerImage = backgroundValue
				hideIncomingLayer()
				return
			}

			if (activeLayerImage === backgroundValue) {
				hideIncomingLayer()
				return
			}

			incomingLayer.classList.remove('is-visible')
			incomingLayer.style.backgroundImage = backgroundValue
			void incomingLayer.offsetWidth
			incomingLayer.classList.add('is-visible')

			layerTransitionTimerId = window.setTimeout(() => {
				if (requestId !== themeRequestId) {
					return
				}

				baseLayer.style.backgroundImage = backgroundValue
				activeLayerImage = backgroundValue
				hideIncomingLayer()
				layerTransitionTimerId = 0
			}, 820)
		}

		previewImage.onerror = () => {
			if (requestId !== themeRequestId) {
				return
			}

			if (theme.id !== themes[0].id) {
				if (persist) {
					storeTheme(themes[0].id)
				}

				applyTheme(themes[0].id, false)
			}
		}

		previewImage.src = imageUrl
	}

	toggle.addEventListener('click', () => {
		const activeIndex = themes.findIndex(theme => theme.id === currentTheme)
		const nextTheme = themes[(activeIndex + 1 + themes.length) % themes.length]
		applyTheme(nextTheme.id)
	})

	for (const viewportTheme of viewportThemes) {
		if (!viewportTheme.query) {
			continue
		}

		addMediaQueryListener(viewportTheme.query, () => {
			applyTheme(currentTheme, false)
		})
	}

	applyTheme(currentTheme, false)

	function getStoredTheme() {
		const storedTheme = getLocalStorageTheme(storageKey) || getCookieTheme(storageKey)
		if (themes.some(theme => theme.id === storedTheme)) {
			return storedTheme
		}

		return themes[0].id
	}

	function getBackgroundSize() {
		const activeViewport = viewportThemes.find(viewportTheme => viewportTheme.query && viewportTheme.query.matches)
		return activeViewport ? activeViewport.size : viewportThemes[viewportThemes.length - 1].size
	}

	function syncBrowserThemeColor(theme) {
		if (!themeColorMeta) {
			return
		}

		themeColorMeta.setAttribute('content', theme.meta || theme.accent)
	}

	function storeTheme(themeId) {
		try {
			window.localStorage.setItem(storageKey, themeId)
		} catch (error) {}

		try {
			document.cookie = `${storageKey}=${encodeURIComponent(themeId)}; max-age=31536000; path=/; SameSite=Lax`
		} catch (error) {}
	}

	function getLocalStorageTheme(key) {
		try {
			return window.localStorage.getItem(key)
		} catch (error) {
			return ''
		}
	}

	function getCookieTheme(key) {
		try {
			const storedValue = document.cookie.split('; ').find(entry => entry.startsWith(`${key}=`))

			return storedValue ? decodeURIComponent(storedValue.slice(key.length + 1)) : ''
		} catch (error) {
			return ''
		}
	}
}
