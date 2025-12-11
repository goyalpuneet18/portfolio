import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  OnDestroy,
  OnInit,
  Pipe,
  PipeTransform,
  signal,
  ViewChild,
  AfterViewInit
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { CommonModule, DatePipe } from '@angular/common';

@Pipe({ name: 'safeHtml', standalone: true })
export class SafeHtmlPipe implements PipeTransform {
  private sanitizer = inject(DomSanitizer);
  transform(value: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(value);
  }
}

@Component({
  selector: 'app-terminal',
  standalone: true,
  imports: [FormsModule, SafeHtmlPipe, CommonModule],
  templateUrl: './terminal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [DatePipe]
})
export class TerminalComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('terminalScreen') private terminalScreen!: ElementRef;
  @ViewChild('inputField') private inputField!: ElementRef<HTMLInputElement>;
  @ViewChild('cardContainer') private cardContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('cardWrapper') private cardWrapper!: ElementRef<HTMLDivElement>;
  @ViewChild('interactiveCard') private interactiveCard!: ElementRef<HTMLDivElement>;
  @ViewChild('lanyardPath') private lanyardPath!: ElementRef<SVGPathElement>;
  @ViewChild('lanyardClip') private lanyardClip!: ElementRef<SVGPathElement>;
  @ViewChild('lanyardAnchorClip') private lanyardAnchorClip!: ElementRef<SVGPathElement>;

  history = signal<string[]>([]);
  command = signal('');
  isProcessing = signal(false);
  prompt = 'puneet@portfolio:~$ ';
  currentTime = signal(new Date());

  headerCommands = ['help', 'about', 'projects', 'skills', 'contact', 'certifications', 'clear'];

  private clockInterval: any;
  private isDragging = false;
  private offsetX = 0;
  private offsetY = 0;
  private cardListeners: { event: string; target: EventTarget; handler: EventListenerOrEventListenerObject; }[] = [];

  private restingPosition = { x: 0, y: 0 };
  private cardPosition = { x: 0, y: 0 };
  private cardVelocity = { x: 0, y: 0 };
  private physicsAnimationId: number | null = null;
  private readonly springConstant = 0.035;
  private readonly damping = 0.8;


  private commands: Record<string, () => string> = {
    'help': () => this.getHelpOutput(),
    'about': () => `
        <p>Full Stack Developer with expertise in building scalable web and mobile applications.</p>
        <p>Passionate about creating innovative solutions using cutting-edge technologies, from AI-powered tools to cross-platform mobile apps.</p>
        <p>Committed to writing clean, maintainable code and delivering exceptional user experiences.</p>
    `,
    'projects': () => this.getProjectsOutput(),
    'skills': () => this.getSkillsOutput(),
    'contact': () => `
        <p>You can reach me via:</p>
        <ul>
            <li>📧 Email: <a href="mailto:puneet.goyal018@gmail.com" class="terminal-link">puneet.goyal018@gmail.com</a></li>
            <li>🔗 LinkedIn: <a href="https://linkedin.com/in/puneet-goyal-a056a6109" target="_blank" class="terminal-link">linkedin.com/in/puneet-goyal-a056a6109</a></li>
            <li>🐙 GitHub: <a href="https://github.com/goyalpuneet18" target="_blank" class="terminal-link">github.com/goyalpuneet18</a></li>
        </ul>
    `,
    'certifications': () => `
        <h3>📜 Certifications</h3>
        <ul>
            <li>- Microsoft Technology Associate: Database Administration Fundamentals (MTA)</li>
            <li>- Google Cybersecurity Certificate</li>
            <li>- Oracle AI Vector Search Certified Professional</li>
        </ul>
    `,
    'welcome': () => `
        <p class="text-green-400">Welcome to my interactive portfolio terminal.</p>
        <p>Type <span class="text-green-400">'help'</span> to see a list of available commands.</p>
        <p>You can also click on the commands in the header.</p>
    `,
    'clear': () => {
      this.history.set([]);
      return '';
    }
  };

  private projectsData = [
    {
      title: 'Coaching Companion Bot',
      description: 'Telegram bot using multi-agent architecture to provide personalized coaching and guidance.',
      tech: 'Telegram API, Multi-Agent, Python, AI'
    },
    {
      title: 'Financial PDF Reader',
      description: 'React application that reads financial PDFs, converts them to Excel, and provides AI-based analytics.',
      tech: 'React, PDF.js, AI, Excel Export'
    },
    {
      title: 'Secure QR Generator',
      description: 'QR code generator with built-in tokenization for enhanced security.',
      tech: 'Node.js, QR Code, Security, JWT'
    },
    {
      title: 'Zapier Integration App',
      description: 'Custom Zapier application enabling workflow automation and third-party integrations.',
      tech: 'Zapier CLI, REST API, Webhooks'
    },
    {
      title: 'Flutter Mobile App',
      description: 'Cross-platform mobile application for real-time data visualization and management.',
      tech: 'Flutter, Dart, Firebase, Mobile'
    }
  ];

  private skillsByCategory = [
    { category: 'Programming Languages', list: ['Java', 'Python', 'Dot-Net Core', 'Node.js', 'MongoDB', 'MS SQL', 'Kotlin', 'JavaScript'] },
    { category: 'Frameworks', list: ['Angular 12+', 'React', 'Spring-boot 3', 'Flutter', 'Flask', 'Kafka', 'Moon.js'] },
    { category: 'Tools', list: ['Git-lab', 'Pivotal Cloud Foundry', 'Docker', 'Selenium', 'Kubernetes', 'Figma'] },
    { category: 'AI/ML Models', list: ['Llama-3-1-8b-instruct', 'Mistral-7b-instruct-v03'] }
  ];

  constructor() {
    effect(() => {
      this.history();
      setTimeout(() => this.scrollToBottom(), 0);
    });
  }

  async ngOnInit(): Promise<void> {
    this.startClock();
    this.isProcessing.set(true);
    await this.executeCommand('welcome');
    this.isProcessing.set(false);
    this.focusInput();
  }

  ngAfterViewInit(): void {
    if (this.interactiveCard && this.cardContainer) {
      setTimeout(() => {
        this.restingPosition = {
          x: this.cardWrapper.nativeElement.offsetLeft,
          y: this.cardWrapper.nativeElement.offsetTop
        };
        this.cardPosition = { ...this.restingPosition };
        this.initInteractiveCard();
        this.updateLanyard();
      }, 300);
    }
  }

  ngOnDestroy(): void {
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
    }
    if (this.physicsAnimationId) {
      cancelAnimationFrame(this.physicsAnimationId);
    }
    this.cardListeners.forEach(({ event, target, handler }) => {
      target.removeEventListener(event, handler);
    });
    this.cardListeners = [];
  }

  focusInput(): void {
    setTimeout(() => this.inputField.nativeElement.focus(), 0);
  }

  runCommandFromHeader(cmd: string): void {
    if (this.isProcessing()) return;

    this.history.update(h => [...h, `<span class="text-green-400 font-bold">${this.prompt}</span> ${cmd}`]);
    this.command.set('');
    this.isProcessing.set(true);

    setTimeout(async () => {
      await this.executeCommand(cmd);
      if (cmd === 'clear') {
        await this.executeCommand('welcome');
      }
      this.isProcessing.set(false);
      this.focusInput();
    }, 100);
  }

  onCommandSubmit(): void {
    const commandText = this.command().trim().toLowerCase();
    if (commandText === '') {
      this.history.update(h => [...h, `<span class="text-green-400 font-bold">${this.prompt}</span>`]);
      return;
    };

    this.history.update(h => [...h, `<span class="text-green-400 font-bold">${this.prompt}</span> ${commandText}`]);
    this.command.set('');
    this.isProcessing.set(true);

    setTimeout(async () => {
      await this.executeCommand(commandText);
      if (commandText === 'clear') {
        await this.executeCommand('welcome');
      }
      this.isProcessing.set(false);
      this.focusInput();
    }, 300);
  }

  private async executeCommand(cmd: string): Promise<void> {
    const commandFn = this.commands[cmd];
    if (commandFn) {
      const output = commandFn();
      if (output) {
        await this.typeOutput(output);
      }
    } else {
      await this.typeOutput(`<span class="text-red-500">bash: ${cmd}: command not found</span>`, 5);
    }
  }

  private typeOutput(text: string, speed: number = 10): Promise<void> {
    return new Promise(resolve => {
      this.history.update(h => [...h, '']);

      let i = 0;
      const typeWriter = () => {
        if (i < text.length) {
          let partToAppend = text[i];

          if (partToAppend === '<') {
            const tagEndIndex = text.indexOf('>', i);
            if (tagEndIndex !== -1) {
              partToAppend = text.substring(i, tagEndIndex + 1);
              i = tagEndIndex;
            }
          }

          this.history.update(h => {
            const newHistory = [...h];
            newHistory[newHistory.length - 1] += partToAppend;
            return newHistory;
          });

          i++;
          setTimeout(typeWriter, speed);
        } else {
          resolve();
        }
      };

      typeWriter();
    });
  }

  private startClock(): void {
    this.clockInterval = setInterval(() => {
      this.currentTime.set(new Date());
    }, 1000);
  }

  private scrollToBottom(): void {
    try {
      this.terminalScreen.nativeElement.scrollTop = this.terminalScreen.nativeElement.scrollHeight;
    } catch (err) { }
  }

  private initInteractiveCard(): void {
    const wrapper = this.cardWrapper.nativeElement;
    const card = this.interactiveCard.nativeElement;
    const container = this.cardContainer.nativeElement;

    const onMouseDown = (e: MouseEvent) => {
      if (this.physicsAnimationId) {
        cancelAnimationFrame(this.physicsAnimationId);
        this.physicsAnimationId = null;
      }
      this.isDragging = true;
      wrapper.style.cursor = 'grabbing';
      wrapper.style.transition = 'none';
      card.style.transition = 'transform 0.1s';
      card.style.transform = 'scale(1.05)';
      this.offsetX = e.clientX - wrapper.getBoundingClientRect().left;
      this.offsetY = e.clientY - wrapper.getBoundingClientRect().top;
      this.cardVelocity = { x: 0, y: 0 };
      e.preventDefault();
    };

    const onDocumentMouseMove = (e: MouseEvent) => {
      if (this.isDragging) {
        const containerRect = container.getBoundingClientRect();
        let newX = e.clientX - containerRect.left - this.offsetX;
        let newY = e.clientY - containerRect.top - this.offsetY;

        const cardRect = wrapper.getBoundingClientRect();
        newX = Math.max(0, Math.min(newX, containerRect.width - cardRect.width));
        newY = Math.max(0, Math.min(newY, containerRect.height - cardRect.height));

        this.cardVelocity.x = newX - this.cardPosition.x;
        this.cardVelocity.y = newY - this.cardPosition.y;

        this.cardPosition = { x: newX, y: newY };
        wrapper.style.left = `${newX}px`;
        wrapper.style.top = `${newY}px`;

        this.updateLanyard();
      }
    };

    const onDocumentMouseUp = () => {
      if (this.isDragging) {
        this.isDragging = false;
        wrapper.style.cursor = 'grab';
        card.style.transition = 'transform 0.4s ease-out';
        card.style.transform = 'scale(1) rotateX(0deg) rotateY(0deg)';
        this.runPhysics();
      }
    };

    const onContainerMouseMove = (e: MouseEvent) => {
      if (!this.isDragging) {
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const deltaX = x - centerX;
        const deltaY = y - centerY;

        const maxRotate = 15;
        const rotateX = (deltaY / centerY) * -maxRotate;
        const rotateY = (deltaX / centerX) * maxRotate;

        card.style.transition = 'transform 0.1s linear';
        card.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
      }
    };

    const onContainerMouseLeave = () => {
      if (!this.isDragging) {
        card.style.transition = 'transform 0.5s ease-out';
        card.style.transform = 'rotateX(0deg) rotateY(0deg)';
      }
    };


    const addListener = (target: EventTarget, event: string, handler: EventListenerOrEventListenerObject) => {
      target.addEventListener(event, handler);
      this.cardListeners.push({ target, event, handler });
    };

    addListener(wrapper, 'mousedown', onMouseDown as EventListener);
    addListener(document, 'mousemove', onDocumentMouseMove);
    addListener(document, 'mouseup', onDocumentMouseUp);
    addListener(container, 'mousemove', onContainerMouseMove as EventListener);
    addListener(container, 'mouseleave', onContainerMouseLeave as EventListener);
  }

  private runPhysics(): void {
    const dx = this.restingPosition.x - this.cardPosition.x;
    const dy = this.restingPosition.y - this.cardPosition.y;

    const forceX = dx * this.springConstant;
    const forceY = dy * this.springConstant;

    this.cardVelocity.x = (this.cardVelocity.x + forceX) * this.damping;
    this.cardVelocity.y = (this.cardVelocity.y + forceY) * this.damping;

    this.cardPosition.x += this.cardVelocity.x;
    this.cardPosition.y += this.cardVelocity.y;

    this.cardWrapper.nativeElement.style.left = `${this.cardPosition.x}px`;
    this.cardWrapper.nativeElement.style.top = `${this.cardPosition.y}px`;

    this.updateLanyard();

    const speed = Math.sqrt(this.cardVelocity.x ** 2 + this.cardVelocity.y ** 2);
    const displacement = Math.sqrt(dx ** 2 + dy ** 2);

    if (speed < 0.1 && displacement < 0.1) {
      this.cardWrapper.nativeElement.style.left = `${this.restingPosition.x}px`;
      this.cardWrapper.nativeElement.style.top = `${this.restingPosition.y}px`;
      this.cardPosition = { ...this.restingPosition };
      this.cardVelocity = { x: 0, y: 0 };
      this.updateLanyard();
      this.physicsAnimationId = null;
    } else {
      this.physicsAnimationId = requestAnimationFrame(this.runPhysics.bind(this));
    }
  }


  private updateLanyard(): void {
    if (!this.cardContainer || !this.cardWrapper || !this.lanyardPath || !this.lanyardClip || !this.lanyardAnchorClip) {
      return;
    }

    const container = this.cardContainer.nativeElement;
    const wrapper = this.cardWrapper.nativeElement;
    const path = this.lanyardPath.nativeElement;
    const clip = this.lanyardClip.nativeElement;
    const anchorClip = this.lanyardAnchorClip.nativeElement;

    const anchorX = container.offsetWidth / 2;

    anchorClip.setAttribute('transform', `translate(${anchorX}, 0)`);

    const anchorPoint = {
      x: anchorX,
      y: 10,
    };

    const cardAttachPoint = {
      x: wrapper.offsetLeft + wrapper.offsetWidth / 2,
      y: wrapper.offsetTop,
    };

    const midX = (anchorPoint.x + cardAttachPoint.x) / 2;
    const midY = (anchorPoint.y + cardAttachPoint.y) / 2;

    const sag = Math.abs(anchorPoint.x - cardAttachPoint.x) * 0.3 + 20;

    const controlPoint = {
      x: midX,
      y: midY + sag,
    };

    const pathData = `M ${anchorPoint.x} ${anchorPoint.y} Q ${controlPoint.x} ${controlPoint.y} ${cardAttachPoint.x} ${cardAttachPoint.y}`;
    path.setAttribute('d', pathData);

    clip.setAttribute('transform', `translate(${cardAttachPoint.x}, ${cardAttachPoint.y})`);
  }

  private getHelpOutput(): string {
    return `
      <h3>Available commands:</h3>
      <table>
        ${this.headerCommands.filter(c => c !== 'welcome').map(cmd => `
          <tr>
            <td class="pr-4 text-green-400">${cmd}</td>
            <td>- ${this.getCommandDescription(cmd)}</td>
          </tr>
        `).join('')}
      </table>
    `;
  }

  private getCommandDescription(cmd: string): string {
    const descriptions: Record<string, string> = {
      'help': 'Shows this help message.',
      'about': 'Learn about me.',
      'projects': 'View my projects.',
      'skills': 'See my technical skills.',
      'contact': 'How to reach me.',
      'certifications': 'View my certifications.',
      'clear': 'Clear the terminal.'
    };
    return descriptions[cmd] || 'No description available.';
  }

  private getProjectsOutput(): string {
    let output = '<h3><span class="text-green-400">✓</span> Projects:</h3><ul>';
    this.projectsData.forEach((p, i) => {
      output += `
            <li class="mb-4">
                <p>${i + 1}. ${p.title}</p>
                <p class="pl-4">${p.description}</p>
                <p class="pl-4 text-gray-400">Technologies: ${p.tech}</p>
            </li>
          `;
    });
    output += '</ul>';
    return output;
  }

  private getSkillsOutput(): string {
    let output = '<h3>🛠️ Skills:</h3>';
    this.skillsByCategory.forEach(cat => {
      output += `
            <div class="mb-2">
                <h4 class="underline">${cat.category}:</h4>
                <p class="text-gray-300">${cat.list.join(', ')}</p>
            </div>
          `;
    });
    return output;
  }
}
