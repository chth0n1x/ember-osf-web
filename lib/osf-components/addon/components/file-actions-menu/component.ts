/* eslint-disable max-len */
/* eslint-disable no-console */
import { tagName } from '@ember-decorators/component';
import Component from '@ember/component';
import { layout } from 'ember-osf-web/decorators/component';
import styles from './styles';
import template from './template';

@layout(template, styles)
@tagName('')
export default class FilesActionMenu extends Component {}
