/*
 * This file is part of KubeSphere Console.
 * Copyright (C) 2019 The KubeSphere Console Authors.
 *
 * KubeSphere Console is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * KubeSphere Console is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with KubeSphere Console.  If not, see <https://www.gnu.org/licenses/>.
 */

import React from 'react'
import { observer } from 'mobx-react'
import { isEmpty, get, set, cloneDeep } from 'lodash'

import { Notify } from '@kube-design/components'
import { Panel } from 'components/Base'
import DingTalkForm from 'components/Forms/Notification/DingTalkForm'
import BaseBanner from 'settings/components/Cards/Banner'

import ConfigStore from 'stores/notification/config'
import ReceiverStore from 'stores/notification/receiver'
import SecretStore from 'stores/notification/secret'

import { safeBtoa } from 'utils/base64'
import FORM_TEMPLATES from 'utils/form.templates'

const CONFIG_NAME = 'default-dingtalk-config'
const RECEIVER_NAME = 'global-dingtalk-receiver'
const SECRET_NAME = 'global-dingtalk-config-secret'

@observer
export default class DingTalk extends React.Component {
  configStore = new ConfigStore()

  receiverStore = new ReceiverStore()

  secretStore = new SecretStore()

  state = {
    formData: {
      config: this.configFormTemplate,
      receiver: this.receiverFormTemplate,
      secret: this.secretTemplate,
    },
    formStatus: 'create',
  }

  formData = {
    config: this.configFormTemplate,
    receiver: this.receiverFormTemplate,
    secret: this.secretTemplate,
  }

  get configFormTemplate() {
    return FORM_TEMPLATES['notificationconfigs']({ name: CONFIG_NAME })
  }

  get receiverFormTemplate() {
    return FORM_TEMPLATES['notificationreceivers']({
      name: RECEIVER_NAME,
      type: 'dingtalk',
    })
  }

  get secretTemplate() {
    return FORM_TEMPLATES['globalsecret']({ name: SECRET_NAME })
  }

  componentDidMount() {
    this.fetchData()
  }

  fetchData = async () => {
    const results = await this.configStore.fetchList({ type: 'dingtalk' })
    const config = results.find(
      item => get(item, 'metadata.name') === CONFIG_NAME
    )

    if (!isEmpty(config)) {
      const [receivers, secrets] = await Promise.all([
        this.receiverStore.fetchList({
          name: RECEIVER_NAME,
        }),
        this.secretStore.fetchList({ name: SECRET_NAME }),
      ])

      this.formData = {
        config,
        receiver: set(this.receiverFormTemplate, 'spec', receivers[0].spec),
        secret: set(this.secretTemplate, 'data', get(secrets, '[0].data', {})),
      }
      this.setState({
        formData: cloneDeep(this.formData),
        formStatus: 'update',
      })
    }
  }

  getVerifyFormTemplate = data => {
    const { config, receiver, secret } = cloneDeep(data)
    set(
      config,
      'spec.dingtalk.conversation.appkey.value',
      get(secret, 'data.appkey')
    )
    set(
      config,
      'spec.dingtalk.conversation.appsecret.value',
      get(secret, 'data.appsecret')
    )

    set(
      receiver,
      'spec.dingtalk.chatbot.webhook.value',
      get(secret, 'data.webhook')
    )
    set(
      receiver,
      'spec.dingtalk.chatbot.secret.value',
      get(secret, 'data.chatbotsecret')
    )
    return { config, receiver, secret }
  }

  handleSubmit = async data => {
    const { config, receiver, secret } = cloneDeep(data)
    const { formStatus } = this.state
    let message

    const secretData = get(secret, 'data', {})
    Object.keys(secretData).forEach(key => {
      secretData[key] = safeBtoa(secretData[key])
    })

    set(config, 'spec.dingtalk.conversation.appkey.key', 'appkey')
    set(config, 'spec.dingtalk.conversation.appkey.name', SECRET_NAME)
    set(config, 'spec.dingtalk.conversation.appsecret.key', 'appsecret')
    set(config, 'spec.dingtalk.conversation.appsecret.name', SECRET_NAME)

    set(receiver, 'spec.dingtalk.chatbot.webhook.key', 'webhook')
    set(receiver, 'spec.dingtalk.chatbot.webhook.name', SECRET_NAME)
    set(receiver, 'spec.dingtalk.chatbot.secret.key', 'chatbotsecret')
    set(receiver, 'spec.dingtalk.chatbot.secret.name', SECRET_NAME)

    if (formStatus === 'create') {
      await this.configStore.create(config)
      await this.secretStore.create(
        set(this.secretTemplate, 'data', secretData)
      )
      await this.receiverStore.create(receiver)
      message = t('Added Successfully')
    } else {
      await this.secretStore.update(
        { name: SECRET_NAME },
        set(this.secretTemplate, 'data', secretData)
      )
      await this.receiverStore.update({ name: RECEIVER_NAME }, receiver)
      message = t('UPDATED_SUCCESS_DESC')
    }

    this.fetchData()
    Notify.success({ content: message, duration: 1000 })
  }

  onFormClose = () => {
    this.setState({
      formData: cloneDeep(this.formData),
    })
  }

  render() {
    const { formData, formStatus } = this.state

    return (
      <div>
        <BaseBanner type="dingtalk" />
        <Panel loading={this.configStore.list.isLoading}>
          <DingTalkForm
            formStatus={formStatus}
            data={formData}
            onCancel={this.onFormClose}
            onSubmit={this.handleSubmit}
            getVerifyFormTemplate={this.getVerifyFormTemplate}
            isSubmitting={this.configStore.isSubmitting}
          />
        </Panel>
      </div>
    )
  }
}
