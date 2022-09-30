import Image from "next/image";
import Link from "next/link";
import Head from "next/head";
import { useRouter } from "next/router";
import React, { FunctionComponent, useEffect } from "react";
import classNames from "classnames";
import { observer } from "mobx-react-lite";
import { useStore } from "../../stores";
import {
  useWindowSize,
  useWindowScroll,
  useBooleanWithWindowEvent,
  UserEvent,
  useMatomoAnalytics,
  useAmplitudeAnalytics,
} from "../../hooks";
import { AmplitudeEvent, IS_FRONTIER } from "../../config";
import { NavBar } from "../navbar";

export type MainLayoutMenu = {
  label: string;
  link: string;
  icon: string;
  iconSelected?: string;
  selectionTest?: RegExp;
  userAnalyticsEvent?: UserEvent;
  amplitudeEvent?: AmplitudeEvent;
};

export interface MainLayoutProps {
  menus: MainLayoutMenu[];
}

export const MainLayout: FunctionComponent<MainLayoutProps> = observer(
  ({ children, menus }) => {
    const router = useRouter();
    const { trackEvent } = useMatomoAnalytics();
    const { logEvent } = useAmplitudeAnalytics();
    const { navBarStore } = useStore();

    const { height, isMobile } = useWindowSize();
    const [_, isScrolledTop] = useWindowScroll();
    const [showSidebar, setShowSidebar] = useBooleanWithWindowEvent(false);

    const smallVerticalScreen = height < 850;

    const showFixedLogo = !smallVerticalScreen || (isMobile && !showSidebar);

    const showBlockLogo = smallVerticalScreen;

    const selectedMenuItem = menus.find(
      ({ selectionTest }) => selectionTest?.test(router.pathname) ?? false
    );

    // clear nav bar store on route change
    useEffect(() => {
      router.events.on(
        "routeChangeStart",
        () => (navBarStore.callToActionButtons = [])
      );
    }, []);

    return (
      <React.Fragment>
        {showFixedLogo && (
          <div className="z-50 fixed w-sidebar px-5 pt-6">
            <OsmosisFullLogo onClick={() => router.push("/")} />
          </div>
        )}
        <div
          className={classNames(
            "z-40 fixed w-sidebar h-full bg-card flex flex-col px-2 py-6 overflow-x-hidden overflow-y-auto",
            {
              hidden: !showSidebar && isMobile,
            }
          )}
        >
          {showBlockLogo && (
            <div className="z-50 w-sidebar mx-auto">
              <OsmosisFullLogo width={166} onClick={() => router.push("/")} />
            </div>
          )}
          <div className="h-full pt-20">
            <ul>
              {menus.map(
                ({
                  label,
                  link,
                  icon,
                  iconSelected,
                  selectionTest,
                  userAnalyticsEvent,
                  amplitudeEvent,
                }) => {
                  const selected = selectionTest
                    ? selectionTest.test(router.pathname)
                    : false;
                  return (
                    <li
                      key={label}
                      className={classNames("px-4 py-3 flex items-center", {
                        "rounded-full bg-wosmongton-500": selected,
                      })}
                    >
                      <Head>
                        {selected && <title key="title">{label}</title>}
                      </Head>
                      <Link href={link} passHref>
                        <a
                          className={classNames(
                            "flex items-center hover:opacity-100",
                            selected ? "opacity-100" : "opacity-75"
                          )}
                          target={selectionTest ? "_self" : "_blank"}
                          onClick={() => {
                            if (userAnalyticsEvent) {
                              trackEvent(userAnalyticsEvent);
                            }
                            if (amplitudeEvent) {
                              logEvent(amplitudeEvent);
                            }
                          }}
                        >
                          <div className="w-5 h-5 z-10">
                            <Image
                              src={iconSelected ?? icon}
                              width={20}
                              height={20}
                              alt="menu icon"
                            />
                          </div>
                          <p
                            className={classNames(
                              "ml-2.5 text-base overflow-x-hidden font-semibold transition-all max-w-24",
                              {
                                "text-osmoverse-400 group-hover:text-white-mid":
                                  !selected,
                              }
                            )}
                          >
                            {label}
                          </p>
                          {!selectionTest && (
                            <div className="ml-2">
                              <Image
                                src={
                                  IS_FRONTIER
                                    ? "/icons/link-deco-white.svg"
                                    : "/icons/link-deco.svg"
                                }
                                alt="link"
                                width={12}
                                height={12}
                              />
                            </div>
                          )}
                        </a>
                      </Link>
                    </li>
                  );
                }
              )}
            </ul>
          </div>
        </div>
        <div
          className={classNames(
            "fixed flex z-40 h-mobile-header w-screen items-center justify-end px-5",
            {
              "bg-black/80": !isScrolledTop && isMobile,
              hidden: showSidebar || !isMobile,
            }
          )}
        >
          <div
            className={classNames({ hidden: showSidebar })}
            onClick={() => setShowSidebar(true)}
          >
            <Image
              alt="menu"
              src={IS_FRONTIER ? "/icons/menu-white.svg" : "/icons/menu.svg"}
              height={38}
              width={38}
            />
          </div>
        </div>
        {showSidebar && (
          <div className="fixed ml-sidebar md:ml-0 h-content w-screen bg-black/30" />
        )}
        <NavBar className="ml-sidebar" title={selectedMenuItem?.label ?? ""} />
        <div className="ml-sidebar md:ml-0 h-content">{children}</div>
      </React.Fragment>
    );
  }
);

const OsmosisFullLogo: FunctionComponent<{
  width?: number;
  height?: number;
  onClick?: () => void;
}> = ({ width = 178, height = 48, onClick }) => (
  <Image
    className="hover:cursor-pointer"
    src={IS_FRONTIER ? "/osmosis-logo-frontier.svg" : "/osmosis-logo-main.svg"}
    alt="osmosis logo"
    width={width}
    height={height}
    onClick={(e) => {
      e.stopPropagation();
      onClick?.();
    }}
  />
);
