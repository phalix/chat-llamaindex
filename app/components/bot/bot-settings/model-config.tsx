import { Checkbox } from "@/app/components/ui/checkbox";
import { Button } from "@/app/components/ui/button";
import { Input, InputRange } from "@/app/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import Locale from "../../../locales";
import { Card, CardContent } from "../../ui/card";
import ConfigItem from "./config-item";
import {
  ALL_MODELS,
  ModelType,
  LLMConfig,
} from "../../../client/platforms/llm";
import React from "react";

function limitNumber(
  x: number,
  min: number,
  max: number,
  defaultValue: number,
) {
  if (typeof x !== "number" || isNaN(x)) {
    return defaultValue;
  }

  return Math.min(max, Math.max(min, x));
}

const ModalConfigValidator = {
  model(x: string) {
    return x as ModelType;
  },
  maxTokens(x: number) {
    return limitNumber(x, 0, 4096, 2000);
  },
  temperature(x: number) {
    return limitNumber(x, 0, 1, 1);
  },
  topP(x: number) {
    return limitNumber(x, 0, 1, 1);
  },
};

export async function getServerSideProps() {
  return { props: { all_models: ALL_MODELS } };
}

export function ModelConfigList(props: {
  modelConfig: LLMConfig;
  updateConfig: (updater: (config: LLMConfig) => void) => void;
}) {
  const [ALL_MODELS, setAllModels] = React.useState([]);
  React.useEffect(() => {
    fetch("/api/llm").then((x) => {
      x.json().then((x) => {
        setAllModels(x);
      });
    });
  }, []);

  const downloadModel = async () => {
    const body = JSON.stringify({ name: props.modelConfig.model });
    console.log(body);
    fetch("/api/llm", { method: "PUT", body: body }).then((x) =>
      console.log(x),
    );
  };

  return (
    <Card>
      <CardContent className="divide-y p-5">
        <ConfigItem title={Locale.Settings.Model}>
          <Select
            value={props.modelConfig.model}
            onValueChange={(value) => {
              props.updateConfig(
                (config) => (config.model = ModalConfigValidator.model(value)),
              );
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              {ALL_MODELS.map((model) => (
                <SelectItem value={model} key={model}>
                  {model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ConfigItem>
        <ConfigItem title={Locale.Settings.Model}>
          <Button onClick={downloadModel}>Download and Provide Model</Button>
        </ConfigItem>

        <ConfigItem
          title={Locale.Settings.Temperature.Title}
          subTitle={Locale.Settings.Temperature.SubTitle}
        >
          <InputRange
            value={(props.modelConfig.temperature ?? 0.5).toFixed(1)}
            min="0"
            max="1" // lets limit it to 0-1
            step="0.1"
            onChange={(e) => {
              props.updateConfig(
                (config) =>
                  (config.temperature = ModalConfigValidator.temperature(
                    e.currentTarget.valueAsNumber,
                  )),
              );
            }}
          ></InputRange>
        </ConfigItem>
        <ConfigItem
          title={Locale.Settings.TopP.Title}
          subTitle={Locale.Settings.TopP.SubTitle}
        >
          <InputRange
            value={(props.modelConfig.topP ?? 1).toFixed(1)}
            min="0"
            max="1"
            step="0.1"
            onChange={(e) => {
              props.updateConfig(
                (config) =>
                  (config.topP = ModalConfigValidator.topP(
                    e.currentTarget.valueAsNumber,
                  )),
              );
            }}
          ></InputRange>
        </ConfigItem>
        <ConfigItem
          title={Locale.Settings.MaxTokens.Title}
          subTitle={Locale.Settings.MaxTokens.SubTitle}
        >
          <Input
            type="number"
            min={100}
            max={100000}
            value={props.modelConfig.maxTokens}
            onChange={(e) =>
              props.updateConfig(
                (config) =>
                  (config.maxTokens = ModalConfigValidator.maxTokens(
                    e.currentTarget.valueAsNumber,
                  )),
              )
            }
          />
        </ConfigItem>

        <ConfigItem title={Locale.Memory.Title} subTitle={Locale.Memory.Send}>
          <Checkbox
            checked={props.modelConfig.sendMemory}
            onCheckedChange={(checked) =>
              props.updateConfig(
                (config) => (config.sendMemory = Boolean(checked)),
              )
            }
          />
        </ConfigItem>
      </CardContent>
    </Card>
  );
}
