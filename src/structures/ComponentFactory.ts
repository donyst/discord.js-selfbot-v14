import BaseMessageComponent, {
  type AnyComponent,
  type MessageComponentTypeResolvable,
  setComponentCreator,
} from './BaseMessageComponent.js';
import MessageActionRow from './MessageActionRow.js';
import MessageButton from './MessageButton.js';
import MessageSelectMenu from './MessageSelectMenu.js';
import TextInputComponent from './TextInputComponent.js';
import SectionComponent from './SectionComponent.js';
import TextDisplayComponent from './TextDisplayComponent.js';
import ThumbnailComponent from './ThumbnailComponent.js';
import MediaGalleryComponent from './MediaGalleryComponent.js';
import FileComponent from './FileComponent.js';
import SeparatorComponent from './SeparatorComponent.js';
import ContainerComponent from './ContainerComponent.js';
import { TypeError as DjsTypeError } from '../errors/index.js';
import { Events, MessageComponentTypes } from '../util/Constants.js';
import type { Client } from '../client/Client.js';
import type { WebhookClient } from '../client/WebhookClient.js';

export function createComponent(
  data: Record<string, unknown> | BaseMessageComponent,
  client?: Client | WebhookClient | null,
): AnyComponent | null {
  if (!data) return null;

  let component: AnyComponent | null = null;
  let type = (data as { type?: MessageComponentTypeResolvable }).type;

  if (typeof type === 'string' && isNaN(Number(type))) {
    type = (MessageComponentTypes as Record<string, number>)[type];
  } else if (typeof type === 'string') {
    type = Number(type);
  }

  switch (type) {
    case MessageComponentTypes.ACTION_ROW: {
      component =
        data instanceof MessageActionRow
          ? (data as AnyComponent)
          : new MessageActionRow(data as unknown as import('./MessageActionRow.js').MessageActionRowOptions, client);
      break;
    }
    case MessageComponentTypes.BUTTON: {
      component =
        data instanceof MessageButton
          ? (data as AnyComponent)
          : new MessageButton(data as unknown as import('./MessageButton.js').MessageButtonOptions);
      break;
    }
    case MessageComponentTypes.STRING_SELECT:
    case MessageComponentTypes.USER_SELECT:
    case MessageComponentTypes.ROLE_SELECT:
    case MessageComponentTypes.MENTIONABLE_SELECT:
    case MessageComponentTypes.CHANNEL_SELECT: {
      component =
        data instanceof MessageSelectMenu
          ? (data as AnyComponent)
          : new MessageSelectMenu(data as unknown as import('./MessageSelectMenu.js').MessageSelectMenuOptions);
      break;
    }
    case MessageComponentTypes.TEXT_INPUT: {
      component =
        data instanceof TextInputComponent
          ? (data as AnyComponent)
          : new TextInputComponent(data as unknown as import('./TextInputComponent.js').TextInputComponentOptions);
      break;
    }
    case MessageComponentTypes.SECTION: {
      component =
        data instanceof SectionComponent
          ? (data as AnyComponent)
          : new SectionComponent(data as unknown as import('./SectionComponent.js').SectionComponentOptions);
      break;
    }
    case MessageComponentTypes.TEXT_DISPLAY: {
      component =
        data instanceof TextDisplayComponent
          ? (data as AnyComponent)
          : new TextDisplayComponent(data as unknown as import('./TextDisplayComponent.js').TextDisplayComponentOptions);
      break;
    }
    case MessageComponentTypes.THUMBNAIL: {
      component =
        data instanceof ThumbnailComponent
          ? (data as AnyComponent)
          : new ThumbnailComponent(data as unknown as import('./ThumbnailComponent.js').ThumbnailComponentOptions);
      break;
    }
    case MessageComponentTypes.MEDIA_GALLERY: {
      component =
        data instanceof MediaGalleryComponent
          ? (data as AnyComponent)
          : new MediaGalleryComponent(data as unknown as import('./MediaGalleryComponent.js').MediaGalleryComponentOptions);
      break;
    }
    case MessageComponentTypes.FILE: {
      component =
        data instanceof FileComponent
          ? (data as AnyComponent)
          : new FileComponent(data as unknown as import('./FileComponent.js').FileComponentOptions);
      break;
    }
    case MessageComponentTypes.SEPARATOR: {
      component =
        data instanceof SeparatorComponent
          ? (data as AnyComponent)
          : new SeparatorComponent(data as unknown as import('./SeparatorComponent.js').SeparatorComponentOptions);
      break;
    }
    case MessageComponentTypes.CONTAINER: {
      component =
        data instanceof ContainerComponent
          ? (data as AnyComponent)
          : new ContainerComponent(data as unknown as import('./ContainerComponent.js').ContainerComponentOptions);
      break;
    }
    default:
      if (client) {
        (client as unknown as { emit(event: string, msg: string): void }).emit(
          Events.DEBUG,
          `[BaseMessageComponent] Received component with unknown type: ${String((data as { type?: unknown }).type)}`,
        );
      } else {
        throw new DjsTypeError('INVALID_TYPE', 'data.type', 'valid MessageComponentType');
      }
  }
  return component;
}

setComponentCreator(createComponent);
